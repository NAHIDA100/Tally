import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { useSQLiteContext } from 'expo-sqlite';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { listAccounts } from '@/src/db/repository/accounts';
import { listCategories } from '@/src/db/repository/categories';
import { importSeeds, listTransactions } from '@/src/db/repository/transactions';
import { parseBackup, transactionsToCsv, transactionsToJson, type NameMaps } from '@/src/logic/backup';
import { Screen } from '@/src/components/Screen';
import { useAppStore } from '@/src/store/app';
import { fontSize, radius, spacing } from '@/src/theme/tokens';
import { useTheme } from '@/src/theme/useTheme';
import type { Account, Category } from '@/src/types';

function buildMaps(categories: Category[], accounts: Account[]): NameMaps {
  return {
    categoryNameById: new Map(categories.map((c) => [c.id, c.name])),
    categoryIdByName: new Map(categories.map((c) => [c.name, c.id])),
    accountNameById: new Map(accounts.map((a) => [a.id, a.name])),
    accountIdByName: new Map(accounts.map((a) => [a.name, a.id])),
  };
}

function stamp(): string {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`;
}

/**
 * 导出落点。
 *
 * 只能落在 expo-file-system 允许的自有目录里：新 API 会校验路径必须属于本应用的
 * filesDir/cacheDir，写 /storage/emulated/0/Android/data/... 会被
 * 「Missing 'READ' permission」直接拒（真机实测）。
 * 而即便落到 Android/data 也没意义 —— Android 11+ 的文件管理器基本不显示那个目录。
 * 所以这里用 document（= filesDir，不像 cache 会被系统回收），取文件依赖分享，
 * 并在提示里明说不要指望 ROM 的「保存到手机」。
 */
function exportDirectory(): Directory {
  return Paths.document;
}

async function shareExport(file: File, format: 'csv' | 'json', count: number): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    Alert.alert('无法分享', '这台设备没有可用的分享目标，暂时取不出这个文件。');
    return;
  }
  try {
    await Sharing.shareAsync(file.uri, {
      mimeType: format === 'csv' ? 'text/csv' : 'application/json',
      dialogTitle: `导出 ${count} 笔记录`,
    });
  } catch (error) {
    // 分享面板被系统 ROM 拒掉时不能让用户以为导出失败 —— 文件此时确实已经在磁盘上
    Alert.alert(
      '分享没成功',
      (error instanceof Error ? error.message : '未知错误') + '\n\n账本本身已导出，没有丢。'
    );
  }
}

export default function ExportImportScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const bump = useAppStore((state) => state.bump);
  const [busy, setBusy] = useState(false);

  async function exportAs(format: 'csv' | 'json') {
    setBusy(true);
    try {
      const [rows, categories, accounts] = await Promise.all([
        listTransactions(db, {}),
        listCategories(db),
        listAccounts(db, true),
      ]);
      const maps = buildMaps(categories, accounts);
      const content =
        format === 'csv'
          // BOM 是给 Excel 的：没有它 Excel 会把 UTF-8 中文按本地编码猜，全是乱码
          ? `\uFEFF${transactionsToCsv(rows, maps)}`
          : transactionsToJson(rows, maps);

      const file = new File(exportDirectory(), `tally-${stamp()}.${format}`);
      file.create({ overwrite: true, intermediates: true });
      await file.write(content);

      // 先确认写盘成功，再让用户主动选择分享。
      // 之前是写完直接弹分享面板，用户点了 ROM 的「保存到手机」以为拿到了，
      // 实际部分 ROM（荣耀实测）静默什么都不做。所以这里明说要选具体 App。
      Alert.alert(
        `已导出 ${rows.length} 笔`,
        '下一步请选一个具体的应用来接收文件，例如「文件管理」「QQ」「微信」。\n\n' +
          '注意：部分手机分享面板里的「保存到手机」不会真正写出文件，别依赖它。',
        [
          { text: '知道了', style: 'cancel' },
          {
            text: '选择接收应用',
            onPress: () => {
              void shareExport(file, format, rows.length);
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('导出失败', error instanceof Error ? error.message : '未知错误');
    } finally {
      setBusy(false);
    }
  }

  async function importFile() {
    setBusy(true);
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (picked.canceled || picked.assets.length === 0) return;

      const text = await new File(picked.assets[0].uri).text();
      const [rows, categories, accounts] = await Promise.all([
        listTransactions(db, {}),
        listCategories(db),
        listAccounts(db, true),
      ]);
      const { seeds, errors } = parseBackup(text, buildMaps(categories, accounts));

      if (seeds.length === 0) {
        Alert.alert('没有可导入的记录', errors.slice(0, 5).join('\n') || '文件里没有有效数据');
        return;
      }

      Alert.alert(
        '确认导入',
        `可导入 ${seeds.length} 条` +
          (errors.length > 0 ? `，${errors.length} 条有问题会被跳过` : '') +
          '。导入前会先自动导出一份当前数据作为备份。',
        [
          { text: '取消', style: 'cancel' },
          {
            text: '导入',
            onPress: () => {
              void (async () => {
                const maps = buildMaps(categories, accounts);
                // 先导出一份现状：导入是批量写库，出错时至少要有一份可回滚的原始数据
                const backup = new File(exportDirectory(), `tally-backup-${stamp()}.json`);
                backup.create({ overwrite: true, intermediates: true });
                await backup.write(transactionsToJson(rows, maps));

                const result = await importSeeds(db, seeds);
                bump();
                Alert.alert(
                  '导入完成',
                  `新增 ${result.inserted} 条，跳过重复 ${result.skipped} 条。` +
                    (errors.length > 0 ? `\n跳过的问题行：\n${errors.slice(0, 3).join('\n')}` : '') +
                    `\n\n备份文件：${backup.name}`,
                );
              })().catch((error: unknown) => {
                Alert.alert('导入失败', error instanceof Error ? error.message : '未知错误');
              });
            },
          },
        ],
      );
    } catch (error) {
      Alert.alert('导入失败', error instanceof Error ? error.message : '未知错误');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12} style={{ padding: spacing.xs }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <Text style={{ color: theme.text, fontSize: fontSize.title, fontWeight: '600' }}>数据</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <Text style={{ color: theme.textMuted, fontSize: fontSize.body }}>
          所有数据都只存在这台手机上。导出可以把账本带走，或在做批量操作前留一份底。
        </Text>

        <Action
          icon="file-delimited"
          title="导出为 CSV"
          subtitle="可用 Excel 打开，金额为元"
          onPress={() => void exportAs('csv')}
          disabled={busy}
        />
        <Action
          icon="code-json"
          title="导出为 JSON"
          subtitle="包含 id 与名称，适合原样还原"
          onPress={() => void exportAs('json')}
          disabled={busy}
        />
        <Action
          icon="tray-arrow-down"
          title="从文件导入"
          subtitle="按 id 去重，重复执行同一份文件不会写两遍"
          onPress={() => void importFile()}
          disabled={busy}
        />

        {busy ? <ActivityIndicator style={{ marginTop: spacing.md }} color={theme.primary} /> : null}
      </ScrollView>
    </Screen>
  );
}

function Action({
  icon,
  title,
  subtitle,
  onPress,
  disabled,
}: {
  icon: 'file-delimited' | 'code-json' | 'tray-arrow-down';
  title: string;
  subtitle: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: theme.surface,
        borderRadius: radius.card,
        padding: spacing.lg,
        opacity: disabled ? 0.5 : 1,
      }}>
      <MaterialCommunityIcons name={icon} size={24} color={theme.primary} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.text, fontSize: fontSize.body, fontWeight: '500' }}>{title}</Text>
        <Text style={{ color: theme.textMuted, fontSize: fontSize.caption, marginTop: 2 }}>{subtitle}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={18} color={theme.divider} />
    </Pressable>
  );
}

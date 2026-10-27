/// <reference types="nativewind/types" />

// global.css 由 metro.config.js 的 withNativeWind 在打包时处理，
// 但 TS 不认识 .css 后缀，side-effect import 会报 TS2882。
declare module '*.css';

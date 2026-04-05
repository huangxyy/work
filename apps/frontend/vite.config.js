/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
// https://vitejs.dev/config/
export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        coverage: {
            provider: 'v8',
            include: ['src/**/*.{ts,tsx}'],
            exclude: ['src/test/**', 'src/**/*.d.ts', 'src/main.tsx'],
        },
    },
    plugins: [
        react(),
        visualizer({
            open: false,
            gzipSize: true,
            brotliSize: true,
            filename: 'dist/stats.html',
        }),
    ],
    server: {
        host: '0.0.0.0',
        port: 3001,
        // HMR 配置 - 兼容直接访问和 nginx 代理
        hmr: {
            // 不指定 clientPort，让 Vite 自动检测
            // 如果通过 nginx 访问，nginx 会转发 WebSocket
            protocol: 'ws',
            host: 'localhost',
        },
        // 允许通过 nginx 代理访问
        allowedHosts: true,
        cors: true,
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
        },
    },
    build: {
        target: 'es2020',
        cssCodeSplit: true,
        reportCompressedSize: true,
        chunkSizeWarningLimit: 600,
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor-react': ['react', 'react-dom', 'react-router-dom'],
                    'vendor-antd': ['antd', '@ant-design/icons'],
                    'vendor-antd-pro': ['@ant-design/pro-components'],
                    'vendor-charts': ['echarts'],
                    'vendor-pdf': ['html2canvas', 'jspdf'],
                    'vendor-query': ['@tanstack/react-query'],
                },
            },
        },
    },
});

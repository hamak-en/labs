import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests/e2e',workers:1,timeout:45000,reporter:'list',use:{baseURL:'http://127.0.0.1:5174',viewport:{width:1440,height:1050},channel:'chrome',launchOptions:{args:['--enable-unsafe-webgpu']}},webServer:{command:'npm run dev',url:'http://127.0.0.1:5174',reuseExistingServer:true}});

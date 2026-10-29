import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./e2e',fullyParallel:false,workers:1,timeout:60000,
  use:{baseURL:'http://127.0.0.1:5198',viewport:{width:1440,height:1100},
    launchOptions:{args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--enable-unsafe-swiftshader']},
    permissions:['camera'],trace:'retain-on-failure'},
  webServer:[{command:'npm run build && npm run preview -- --port 5198 --strictPort',url:'http://127.0.0.1:5198',reuseExistingServer:false,timeout:60000},{command:'node server/sync.js',url:'http://127.0.0.1:8787',reuseExistingServer:false,timeout:60000}],
});

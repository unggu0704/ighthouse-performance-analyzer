// modules/ChromeManager.js - Chrome 브라우저 관리
const chromeLauncher = require('chrome-launcher');
const { exec } = require('child_process');
const { promisify } = require('util');
const config = require('../config');

const execAsync = promisify(exec);

class ChromeManager {
    constructor() {
        this.chrome = null;
        this.chromePort = null;
    }

    async startChrome() {
        try {
            console.log('🚀 Chrome 브라우저 시작 중...');
            
            // 기존 Chrome 프로세스 정리
            await this.killExistingChrome();
            await this.sleep(2000);

            this.chrome = await chromeLauncher.launch({
                chromeFlags: config.CHROME_FLAGS,
                port: config.CHROME_PORT
            });

            this.chromePort = this.chrome.port;
            console.log(`✅ Chrome 시작 완료 (포트: ${this.chromePort})`);
            
            // 연결 안정화를 위한 대기
            await this.sleep(2000);
            
        } catch (error) {
            console.error('❌ Chrome 시작 실패:', error);
            throw error;
        }
    }

    async stopChrome() {
        try {
            if (this.chrome) {
                console.log('🛑 Chrome 브라우저 종료 중...');
                await this.chrome.kill();
                this.chrome = null;
                this.chromePort = null;
                console.log('✅ Chrome 종료 완료');
            }
        } catch (error) {
            console.error('❌ Chrome 종료 중 오류:', error);
            await this.killExistingChrome();
            this.chrome = null;
            this.chromePort = null;
        }
    }

    async restartChrome() {
        console.log('🔄 Chrome 재시작 중...');
        await this.stopChrome();
        await this.sleep(3000);
        await this.startChrome();
    }

    isRunning() {
        return this.chrome !== null && this.chromePort !== null;
    }

    getPort() {
        return this.chromePort;
    }

    async killExistingChrome() {
        try {
            await execAsync('pkill -f "Google Chrome" || true');
            await execAsync('pkill -f "chrome" || true');
            
            // 포트 정리
            try {
                await execAsync(`lsof -ti:${config.CHROME_PORT} | xargs kill -9 || true`);
            } catch (e) {
                // 무시 - 프로세스가 없을 수 있음
            }
        } catch (error) {
            // 무시 - 프로세스 정리 실패는 치명적이지 않음
        }
    }

    async checkConnection() {
        if (!this.chromePort) return false;
        
        try {
            const { stdout } = await execAsync(`curl -s http://localhost:${this.chromePort}/json || echo "failed"`);
            return !stdout.includes('failed');
        } catch (error) {
            return false;
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = ChromeManager;
// modules/utils.js - 유틸리티 함수들
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class Utils {
    // 시간 대기
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 랜덤 대기 시간 (min ~ max ms)
    static randomSleep(min, max) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        return Utils.sleep(delay);
    }

    // 현재 시간 포맷
    static getCurrentTime() {
        return new Date().toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    // 시간 차이 계산 (초 단위)
    static getTimeDiff(startTime) {
        return Math.floor((Date.now() - startTime) / 1000);
    }

    // 메모리 사용량 확인
    static getMemoryUsage() {
        const used = process.memoryUsage();
        const usage = {};
        
        for (let key in used) {
            usage[key] = Math.round(used[key] / 1024 / 1024 * 100) / 100;
        }
        
        return usage;
    }

    // 프로세스 실행 중 확인
    static async isProcessRunning(processName) {
        try {
            const { stdout } = await execAsync(`ps aux | grep -i "${processName}" | grep -v grep || echo "not found"`);
            return !stdout.includes('not found');
        } catch (error) {
            return false;
        }
    }

    // 포트 사용 중 확인
    static async isPortInUse(port) {
        try {
            const { stdout } = await execAsync(`lsof -i :${port} || echo "not used"`);
            return !stdout.includes('not used');
        } catch (error) {
            return false;
        }
    }

    // URL 유효성 검사
    static isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch (error) {
            return false;
        }
    }

    // 에러 메시지 단순화
    static simplifyErrorMessage(error) {
        if (error.message.includes('ECONNREFUSED')) {
            return '연결이 거부되었습니다 (Chrome이 실행되지 않았을 수 있습니다)';
        }
        if (error.message.includes('PROTOCOL_TIMEOUT')) {
            return 'DevTools 프로토콜 응답 시간 초과';
        }
        if (error.message.includes('CHROME_NOT_INSTALLED')) {
            return 'Chrome 브라우저가 설치되지 않았습니다';
        }
        
        return error.message;
    }

    // 진행률 표시
    static showProgress(current, total, siteName = '') {
        const percentage = Math.floor((current / total) * 100);
        const progressBar = '█'.repeat(Math.floor(percentage / 10)) + '░'.repeat(10 - Math.floor(percentage / 10));
        
        console.log(`\n📈 진행률: [${progressBar}] ${percentage}% (${current}/${total}) ${siteName}`);
    }

    // 파일 크기 포맷
    static formatFileSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${Math.round(size * 100) / 100} ${units[unitIndex]}`;
    }

    // 성능 지표 포맷
    static formatMetrics(metrics) {
        return {
            fcp: `${metrics.fcp}ms`,
            lcp: `${metrics.lcp}ms`,
            tbt: `${metrics.tbt}ms`,
            cls: metrics.cls.toFixed(3),
            si: `${metrics.si}ms`
        };
    }

    // 시스템 정보 출력
    static printSystemInfo() {
        console.log('💻 시스템 정보:');
        console.log(`   Node.js: ${process.version}`);
        console.log(`   Platform: ${process.platform}`);
        console.log(`   Architecture: ${process.arch}`);
        console.log(`   Memory: ${Utils.formatFileSize(process.memoryUsage().rss)}`);
        console.log(`   실행 시간: ${Utils.getCurrentTime()}\n`);
    }

    // 결과 검증
    static validateResults(results) {
        if (!results || typeof results !== 'object') {
            return false;
        }
        
        const requiredFields = ['fcp', 'lcp', 'tbt', 'cls', 'si'];
        return requiredFields.every(field => 
            results.hasOwnProperty(field) && 
            typeof results[field] === 'number' && 
            !isNaN(results[field])
        );
    }

    // 설정 검증
    static validateConfig(config) {
        const requiredFields = ['SITES', 'MEASUREMENTS_PER_CACHE_TYPE', 'CHROME_PORT'];
        
        for (const field of requiredFields) {
            if (!config.hasOwnProperty(field)) {
                throw new Error(`설정에서 ${field}가 누락되었습니다`);
            }
        }
        
        if (!Array.isArray(config.SITES) || config.SITES.length === 0) {
            throw new Error('측정할 사이트가 설정되지 않았습니다');
        }
        
        for (const site of config.SITES) {
            if (!site.name || !site.url || !Utils.isValidUrl(site.url)) {
                throw new Error(`잘못된 사이트 설정: ${JSON.stringify(site)}`);
            }
        }
        
        return true;
    }
}

module.exports = Utils;
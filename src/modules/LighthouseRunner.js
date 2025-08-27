// modules/LighthouseRunner.js - Lighthouse 성능 측정
const lighthouse = require('lighthouse');
const config = require('../config');

class LighthouseRunner {
    constructor(chromeManager) {
        this.chromeManager = chromeManager;
    }

    async measureSingle(url, useCache = false, retryCount = 0) {
        const maxRetries = config.MAX_RETRIES;
        
        try {
            console.log(`   🔍 측정 시작... (최대 ${config.MEASUREMENT_TIMEOUT/1000}초 대기)`);
            
            // Chrome 연결 상태 확인
            if (!this.chromeManager.isRunning()) {
                throw new Error('Chrome이 시작되지 않았습니다');
            }

            const options = {
                ...config.LIGHTHOUSE_OPTIONS,
                port: this.chromeManager.getPort(),
                settings: {
                    ...config.LIGHTHOUSE_OPTIONS.settings,
                    disableStorageReset: useCache,
                    clearStorageTypes: useCache ? [] : [
                        'appcache', 'cookies', 'fileSystems', 'indexedDB', 
                        'localStorage', 'shader_cache', 'websql', 
                        'service_workers', 'cache_storage'
                    ]
                }
            };

            console.log(`   📡 Lighthouse 연결 중... (포트: ${this.chromeManager.getPort()})`);
            const runnerResult = await lighthouse(url, options);
            
            if (!runnerResult || !runnerResult.lhr) {
                throw new Error('Lighthouse 결과가 유효하지 않습니다');
            }

            const result = this.extractMetrics(runnerResult.lhr);
            console.log(`   ✅ 측정 완료`);
            return result;

        } catch (error) {
            console.log(`   ❌ 측정 실패: ${error.message}`);
            
            if (retryCount < maxRetries) {
                console.log(`   🔄 재시도 중... (${retryCount + 1}/${maxRetries})`);
                
                // Chrome 재시작
                try {
                    await this.chromeManager.restartChrome();
                } catch (restartError) {
                    console.log(`   ⚠️ Chrome 재시작 실패: ${restartError.message}`);
                }
                
                await this.sleep(2000);
                return this.measureSingle(url, useCache, retryCount + 1);
            }
            
            throw error;
        }
    }

    async measureMultiple(url, useCache, count) {
        const cacheStatus = useCache ? '있음' : '없음';
        console.log(`🎯 측정 시작 - 캐시 ${cacheStatus} (${count}회)`);

        const results = [];
        
        for (let i = 1; i <= count; i++) {
            console.log(`📊 측정 중: ${url} (캐시 ${cacheStatus}) - ${i}번째`);
            
            try {
                const result = await this.measureSingle(url, useCache);
                results.push(result);
                
                // 측정 간 대기 (마지막 측정 후에는 대기하지 않음)
                if (i < count) {
                    console.log(`   ⏳ ${config.WAIT_TIME_BETWEEN_MEASUREMENTS/1000}초 대기 중...`);
                    await this.sleep(config.WAIT_TIME_BETWEEN_MEASUREMENTS);
                }
                
            } catch (error) {
                console.log(`   ❌ ${i}번째 측정 실패, 기본값 사용`);
                results.push(this.getDefaultMetrics());
            }
        }

        return this.calculateAverage(results);
    }

    extractMetrics(lhr) {
        const audits = lhr.audits;
        return {
            fcp: audits['first-contentful-paint']?.numericValue || 0,
            lcp: audits['largest-contentful-paint']?.numericValue || 0,
            tbt: audits['total-blocking-time']?.numericValue || 0,
            cls: audits['cumulative-layout-shift']?.numericValue || 0,
            si: audits['speed-index']?.numericValue || 0
        };
    }

    getDefaultMetrics() {
        return {
            fcp: 0,
            lcp: 0,
            tbt: 0,
            cls: 0,
            si: 0
        };
    }

    calculateAverage(results) {
        if (results.length === 0) return this.getDefaultMetrics();

        const totals = results.reduce((acc, result) => ({
            fcp: acc.fcp + result.fcp,
            lcp: acc.lcp + result.lcp,
            tbt: acc.tbt + result.tbt,
            cls: acc.cls + result.cls,
            si: acc.si + result.si
        }), this.getDefaultMetrics());

        const count = results.length;
        return {
            fcp: Math.round(totals.fcp / count),
            lcp: Math.round(totals.lcp / count),
            tbt: Math.round(totals.tbt / count),
            cls: Math.round((totals.cls / count) * 1000) / 1000, // CLS는 소수점 3자리
            si: Math.round(totals.si / count)
        };
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = LighthouseRunner;
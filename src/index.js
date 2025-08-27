// index.js - 메인 실행 파일
const ChromeManager = require('./modules/ChromeManager');
const LighthouseRunner = require('./modules/LighthouseRunner');
const ReportGenerator = require('./modules/ReportGenerator');
const Utils = require('./modules/utils');
const config = require('./config');

class PerformanceAnalyzer {
    constructor() {
        this.chromeManager = new ChromeManager();
        this.lighthouseRunner = new LighthouseRunner(this.chromeManager);
        this.reportGenerator = new ReportGenerator();
    }

    async init() {
        console.log('🔍 [DEBUG] KT샵 성능 측정 프로그램 시작');
        
        // 시스템 정보 출력
        Utils.printSystemInfo();
        
        // 설정 검증
        Utils.validateConfig(config);
        
        console.log(`📊 측정 설정: 사이트 ${config.SITES.length}곳, 각각 ${config.MEASUREMENTS_PER_CACHE_TYPE}회씩 측정\n`);
    }

    async runFullAnalysis() {
        const startTime = Date.now();
        const allResults = [];

        try {
            // Chrome 시작
            await this.chromeManager.startChrome();

            // 각 사이트별 측정
            for (let i = 0; i < config.SITES.length; i++) {
                const site = config.SITES[i];
                
                console.log(`\n🌐 [${i + 1}/${config.SITES.length}] ${site.name} 측정`);
                console.log(`📍 URL: ${site.url}`);
                
                // 진행률 표시
                Utils.showProgress(i, config.SITES.length, site.name);

                const siteResult = await this.measureSite(site);
                allResults.push(siteResult);
            }

            // 결과 생성
            await this.generateResults(allResults, startTime);

        } catch (error) {
            console.error(`❌ 전체 분석 실패: ${Utils.simplifyErrorMessage(error)}`);
            throw error;
        } finally {
            // Chrome 종료
            await this.chromeManager.stopChrome();
        }
    }

    async measureSite(site) {
        const siteResult = {
            siteName: site.name,
            url: site.url,
            noCache: null,
            withCache: null
        };

        try {
            // 캐시 없음 측정
            siteResult.noCache = await this.lighthouseRunner.measureMultiple(
                site.url, 
                false, 
                config.MEASUREMENTS_PER_CACHE_TYPE
            );

            console.log(`✅ ${site.name} - 캐시 없음 측정 완료`);

            // 측정 간 대기
            await Utils.sleep(config.WAIT_TIME_BETWEEN_MEASUREMENTS);

            // 캐시 있음 측정  
            siteResult.withCache = await this.lighthouseRunner.measureMultiple(
                site.url, 
                true, 
                config.MEASUREMENTS_PER_CACHE_TYPE
            );

            console.log(`✅ ${site.name} - 캐시 있음 측정 완료`);

        } catch (error) {
            console.error(`❌ ${site.name} 측정 실패: ${Utils.simplifyErrorMessage(error)}`);
            
            // 실패시 기본값 사용
            siteResult.noCache = siteResult.noCache || this.getDefaultMetrics();
            siteResult.withCache = siteResult.withCache || this.getDefaultMetrics();
        }

        return siteResult;
    }

    async generateResults(allResults, startTime) {
        try {
            console.log('\n🎯 측정 완료, 결과 생성 중...');
            
            // 콘솔 리포트 생성
            this.reportGenerator.generateConsoleReport(allResults);
            
            // Excel 리포트 생성
            const excelPath = await this.reportGenerator.generateExcelReport(allResults);
            
            // 완료 정보
            const totalTime = Utils.getTimeDiff(startTime);
            const memoryUsage = Utils.getMemoryUsage();
            
            console.log(`\n🎉 모든 작업 완료!`);
            console.log(`⏱️  총 소요시간: ${totalTime}초`);
            console.log(`💾 메모리 사용량: ${memoryUsage.rss}MB`);
            console.log(`📁 Excel 파일: ${excelPath}`);
            
        } catch (error) {
            console.error(`❌ 결과 생성 실패: ${Utils.simplifyErrorMessage(error)}`);
        }
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
}

// 메인 실행 함수
async function main() {
    console.log('🔍 [DEBUG] main() 함수 정의 완료, 실행 여부 확인 중...');
    
    if (require.main === module) {
        console.log('🔍 [DEBUG] main() 함수 실행 시작');
        
        const analyzer = new PerformanceAnalyzer();
        
        try {
            await analyzer.init();
            await analyzer.runFullAnalysis();
            
        } catch (error) {
            console.error('❌ 프로그램 실행 실패:', Utils.simplifyErrorMessage(error));
            console.error('상세 에러:', error);
            process.exit(1);
            
        } finally {
            console.log('🏁 프로그램 종료');
            process.exit(0);
        }
    }
}

// 프로세스 신호 처리
process.on('SIGINT', async () => {
    console.log('\n⚠️ 프로그램 중단 신호 감지, 정리 중...');
    
    try {
        const chromeManager = new ChromeManager();
        await chromeManager.stopChrome();
    } catch (error) {
        // 무시
    }
    
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('❌ 처리되지 않은 예외:', Utils.simplifyErrorMessage(error));
    process.exit(1);
});

// 실행
main();

module.exports = PerformanceAnalyzer;
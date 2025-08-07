// src/index.js - KT 사이트 자동 성능 측정 도구 (수정된 버전)

// 🔍 디버깅 로그 추가
console.log('🔍 [DEBUG] 스크립트 시작!');
console.log('🔍 [DEBUG] Node.js 버전:', process.version);
console.log('🔍 [DEBUG] 현재 디렉토리:', process.cwd());

console.log('🔍 [DEBUG] 모듈 로드 시작...');
const lighthouse = require('lighthouse');
console.log('🔍 [DEBUG] lighthouse 모듈 로드 완료');

const chromeLauncher = require('chrome-launcher');
console.log('🔍 [DEBUG] chrome-launcher 모듈 로드 완료');

const fs = require('fs-extra');
console.log('🔍 [DEBUG] fs-extra 모듈 로드 완료');

const XLSX = require('xlsx');
console.log('🔍 [DEBUG] xlsx 모듈 로드 완료');

const path = require('path');
console.log('🔍 [DEBUG] path 모듈 로드 완료');

console.log('🔍 [DEBUG] 모든 모듈 로드 성공!');

// 측정 대상 URL들
const TARGET_URLS = [
  {
    name: 'KT 메인',
    url: 'https://shop.kt.com/main.do'
  },
  {
    name: 'KT 모바일 상품',
    url: 'https://shop.kt.com/mobile/products.do?category=mobile'
  },
  {
    name: 'KT 상품 상세',
    url: 'https://shop.kt.com/mobile/view.do?prodNo=WL00075257&sntyNo=WL000752570007&pplId=0942&svcEngtMonsTypeCd=04&supportType=02'
  }
];

// 성능 지표 설정
const PERFORMANCE_METRICS = ['FCP', 'LCP', 'TBT', 'CLS', 'SI'];
const MEASUREMENTS_PER_CACHE_TYPE = 5; // 캐시 유/무 각각 5번씩

console.log('🔍 [DEBUG] 상수 정의 완료');

class PerformanceAnalyzer {
  constructor() {
    console.log('🔍 [DEBUG] PerformanceAnalyzer 생성자 시작');
    this.results = [];
    this.chrome = null;
    this.startTime = new Date();
    console.log('🔍 [DEBUG] PerformanceAnalyzer 생성자 완료');
  }

  // Chrome 브라우저 시작
  async startChrome() {
    console.log('🔍 [DEBUG] startChrome() 함수 시작');
    console.log('🚀 Chrome 브라우저 시작 중...');
    
    try {
      console.log('🔍 [DEBUG] chromeLauncher.launch() 호출 중...');
      this.chrome = await chromeLauncher.launch({
      chromeFlags: ['--headless', '--no-sandbox']

      });
      console.log('🔍 [DEBUG] chromeLauncher.launch() 완료');
      console.log(`✅ Chrome 시작 완료 (포트: ${this.chrome.port})`);
      
      // Chrome이 완전히 준비될 때까지 잠시 대기
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error('🔍 [DEBUG] Chrome 시작 실패:', error.message);
      throw error;
    }
  }

  // Chrome 브라우저 종료
  async stopChrome() {
    console.log('🔍 [DEBUG] stopChrome() 함수 시작');
    if (this.chrome) {
      try {
        await this.chrome.kill();
        console.log('🔄 Chrome 브라우저 종료');
        // 종료 후 약간 대기
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.log('⚠️  Chrome 종료 중 오류 (정상적일 수 있음):', error.message);
      }
      this.chrome = null;
    }
    console.log('🔍 [DEBUG] stopChrome() 함수 완료');
  }

  // 단일 성능 측정 실행
  async measureSingle(url, withCache = true, attempt = 1, retryCount = 0) {
    const cacheStatus = withCache ? '캐시 있음' : '캐시 없음';
    console.log(`📊 측정 중: ${url} (${cacheStatus}) - ${attempt}번째${retryCount > 0 ? ` (재시도 ${retryCount})` : ''}`);

    // Lighthouse 9.x 버전에 맞는 설정 - 타임아웃 단축 및 최적화
    const options = {
        logLevel: 'info',
        output: 'json',
        onlyCategories: ['performance'],
        port: this.chrome.port,
        disableStorageReset: false,
        onlyAudits: [
            'first-contentful-paint',
            'largest-contentful-paint', 
            'total-blocking-time',
            'cumulative-layout-shift',
            'speed-index'
        ]
    };

    try {
      console.log(`   🔍 측정 시작... (최대 30초 대기)`);
      const runnerResult = await lighthouse(url, options);
      
      if (!runnerResult || !runnerResult.lhr) {
        throw new Error('Lighthouse 결과 없음');
      }

      const lhr = runnerResult.lhr;
      const audits = lhr.audits;

      // 5개 핵심 메트릭 추출
      const metrics = {
        FCP: Math.round(audits['first-contentful-paint']?.numericValue || 0),
        LCP: Math.round(audits['largest-contentful-paint']?.numericValue || 0),
        TBT: Math.round(audits['total-blocking-time']?.numericValue || 0),
        CLS: parseFloat((audits['cumulative-layout-shift']?.numericValue || 0).toFixed(3)),
        SI: Math.round(audits['speed-index']?.numericValue || 0)
      };

      console.log(`   ✅ 완료: FCP=${metrics.FCP}ms, LCP=${metrics.LCP}ms, TBT=${metrics.TBT}ms, CLS=${metrics.CLS}, SI=${metrics.SI}ms`);
      
      // 비정상적으로 긴 로딩 시간 체크 (30초 이상)
      if (metrics.FCP > 30000 || metrics.LCP > 30000) {
        console.log(`   ⚠️  경고: 로딩 시간이 비정상적으로 깁니다. 네트워크 상태를 확인하세요.`);
      }
      
      return metrics;

    } catch (error) {
      console.error(`   ❌ 측정 실패: ${error.message}`);
      
      // 특정 에러들에 대한 Chrome 재시작
      const needsChromeRestart = error.message.includes('PROTOCOL') || 
                                 error.message.includes('timeout') || 
                                 error.message.includes('500') ||
                                 error.message.includes('Cannot create new tab');
      
      if (needsChromeRestart && retryCount < 2) { // 최대 2번 재시도
        console.log('   🔄 Chrome 재시작 후 재시도...');
        
        // Chrome 재시작
        await this.stopChrome();
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3초 대기
        await this.startChrome();
        
        // 재시도
        return await this.measureSingle(url, withCache, attempt, retryCount + 1);
      }
      
      // 실패 시 기본값 반환
      return {
        FCP: null, LCP: null, TBT: null, CLS: null, SI: null,
        error: error.message
      };
    }
  }

  // 여러 번 측정 후 평균 계산
  async measureMultiple(url, siteName, withCache = true) {
    const cacheStatus = withCache ? '캐시 있음' : '캐시 없음';
    console.log(`\n🎯 ${siteName} - ${cacheStatus} 측정 시작 (${MEASUREMENTS_PER_CACHE_TYPE}회)`);
    
    const measurements = [];
    
    for (let i = 1; i <= MEASUREMENTS_PER_CACHE_TYPE; i++) {
      const result = await this.measureSingle(url, withCache, i);
      measurements.push(result);
      
      // 측정 간 3초 대기로 단축 (이전 5초에서)
      if (i < MEASUREMENTS_PER_CACHE_TYPE) {
        console.log('   ⏳ 3초 대기 중...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // 평균 계산 (null 값 제외)
    const averages = {};
    PERFORMANCE_METRICS.forEach(metric => {
      const validValues = measurements
        .map(m => m[metric])
        .filter(v => v !== null && !isNaN(v));
      
      if (validValues.length > 0) {
        const avg = validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
        averages[metric] = metric === 'CLS' ? parseFloat(avg.toFixed(3)) : Math.round(avg);
      } else {
        averages[metric] = 0;
      }
    });

    const successCount = measurements.filter(m => !m.error).length;
    console.log(`   📈 평균 결과 (성공: ${successCount}/${MEASUREMENTS_PER_CACHE_TYPE}회)`);
    console.log(`      FCP=${averages.FCP}ms, LCP=${averages.LCP}ms, TBT=${averages.TBT}ms, CLS=${averages.CLS}, SI=${averages.SI}ms`);

    return {
      siteName,
      url,
      cacheStatus,
      measurements,
      averages,
      successCount,
      totalCount: MEASUREMENTS_PER_CACHE_TYPE
    };
  }

  // 전체 측정 실행
  async runFullAnalysis() {
    console.log('🔍 [DEBUG] runFullAnalysis() 함수 시작');
    console.log('🎯 KT 사이트 성능 측정 시작');
    console.log(`📋 측정 대상: ${TARGET_URLS.length}개 사이트`);
    console.log(`📊 총 측정 횟수: ${TARGET_URLS.length * 2 * MEASUREMENTS_PER_CACHE_TYPE}회 (캐시 유/무 각 ${MEASUREMENTS_PER_CACHE_TYPE}회)`);
    console.log('⏱️  예상 소요 시간: 약 10-15분 (최적화됨)\n');

    console.log('🔍 [DEBUG] Chrome 시작 호출 중...');
    await this.startChrome();

    try {
      for (const [index, site] of TARGET_URLS.entries()) {
        console.log(`\n🌐 [${index + 1}/${TARGET_URLS.length}] ${site.name} 측정`);
        console.log(`📍 URL: ${site.url}`);

        // 캐시 없음으로 5번 측정
        const noCacheResult = await this.measureMultiple(site.url, site.name, false);
        this.results.push(noCacheResult);

        // 사이트 간 5초 대기 (단축됨)
        console.log('   ⏳ Chrome 안정화를 위해 5초 대기...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // 캐시 있음으로 5번 측정
        const withCacheResult = await this.measureMultiple(site.url, site.name, true);
        this.results.push(withCacheResult);

        console.log(`✅ ${site.name} 측정 완료\n`);

        // 다음 사이트로 넘어가기 전 Chrome 안정화 (마지막 사이트 제외)
        if (index < TARGET_URLS.length - 1) {
          console.log('   ⏳ 다음 사이트 측정을 위해 7초 대기...');
          await new Promise(resolve => setTimeout(resolve, 7000));
        }
      }

    } catch (error) {
      console.error('❌ 측정 중 오류 발생:', error.message);
      throw error;
    } finally {
      await this.stopChrome();
    }

    console.log('🎉 전체 측정 완료!');
    await this.generateExcelReport();
  }

  // 엑셀 리포트 생성
  async generateExcelReport() {
    console.log('📊 엑셀 리포트 생성 중...');

    // 워크북 생성
    const workbook = XLSX.utils.book_new();

    // 사이트별 데이터 정리 (캐시 없음/있음 순으로)
    const siteData = {};
    TARGET_URLS.forEach(site => {
      const noCacheResult = this.results.find(r => r.siteName === site.name && r.cacheStatus === '캐시 없음');
      const withCacheResult = this.results.find(r => r.siteName === site.name && r.cacheStatus === '캐시 있음');
      
      siteData[site.name] = {
        noCache: noCacheResult,
        withCache: withCacheResult
      };
    });

    // 메인 시트 데이터 준비 - 헤더 생성
    const headers = ['측정회차'];
    
    // 각 사이트별로 캐시 없음/있음 컬럼들 추가
    TARGET_URLS.forEach(site => {
      const siteName = site.name;
      // 캐시 없음 컬럼들
      headers.push(
        `${siteName}(캐시없음) FCP`,
        `${siteName}(캐시없음) LCP`, 
        `${siteName}(캐시없음) TBT`,
        `${siteName}(캐시없음) CLS`,
        `${siteName}(캐시없음) SI`
      );
      // 캐시 있음 컬럼들
      headers.push(
        `${siteName}(캐시있음) FCP`,
        `${siteName}(캐시있음) LCP`,
        `${siteName}(캐시있음) TBT`, 
        `${siteName}(캐시있음) CLS`,
        `${siteName}(캐시있음) SI`
      );
    });

    const sheetData = [headers];

    // 5회차 데이터 행들 생성
    for (let round = 1; round <= MEASUREMENTS_PER_CACHE_TYPE; round++) {
      const row = [`${round}회차`];
      
      TARGET_URLS.forEach(site => {
        const data = siteData[site.name];
        
        // 캐시 없음 데이터
        const noCacheMeasurement = data.noCache?.measurements[round - 1] || {};
        row.push(
          noCacheMeasurement.FCP || '-',
          noCacheMeasurement.LCP || '-', 
          noCacheMeasurement.TBT || '-',
          noCacheMeasurement.CLS || '-',
          noCacheMeasurement.SI || '-'
        );
        
        // 캐시 있음 데이터
        const withCacheMeasurement = data.withCache?.measurements[round - 1] || {};
        row.push(
          withCacheMeasurement.FCP || '-',
          withCacheMeasurement.LCP || '-',
          withCacheMeasurement.TBT || '-', 
          withCacheMeasurement.CLS || '-',
          withCacheMeasurement.SI || '-'
        );
      });
      
      sheetData.push(row);
    }

    // 빈 행 추가
    sheetData.push(Array(headers.length).fill(''));

    // 평균 행 추가
    const avgRow = ['평균'];
    TARGET_URLS.forEach(site => {
      const data = siteData[site.name];
      
      // 캐시 없음 평균
      const noCacheAvg = data.noCache?.averages || {};
      avgRow.push(
        noCacheAvg.FCP || '-',
        noCacheAvg.LCP || '-',
        noCacheAvg.TBT || '-',
        noCacheAvg.CLS || '-',
        noCacheAvg.SI || '-'
      );
      
      // 캐시 있음 평균
      const withCacheAvg = data.withCache?.averages || {};
      avgRow.push(
        withCacheAvg.FCP || '-',
        withCacheAvg.LCP || '-',
        withCacheAvg.TBT || '-',
        withCacheAvg.CLS || '-',
        withCacheAvg.SI || '-'
      );
    });
    
    sheetData.push(avgRow);

    // 성공률 행 추가
    const successRow = ['성공률'];
    TARGET_URLS.forEach(site => {
      const data = siteData[site.name];
      
      // 캐시 없음 성공률
      const noCacheSuccess = data.noCache ? `${data.noCache.successCount}/${data.noCache.totalCount}` : '-';
      successRow.push(noCacheSuccess, '', '', '', ''); // FCP 컬럼에만 성공률 표시, 나머지는 빈칸
      
      // 캐시 있음 성공률  
      const withCacheSuccess = data.withCache ? `${data.withCache.successCount}/${data.withCache.totalCount}` : '-';
      successRow.push(withCacheSuccess, '', '', '', ''); // FCP 컬럼에만 성공률 표시, 나머지는 빈칸
    });
    
    sheetData.push(successRow);

    // 워크시트 생성
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    
    // 컬럼 너비 자동 조정
    const colWidths = headers.map(header => ({
      wch: Math.max(header.length + 2, 10) // 헤더 길이 + 여백, 최소 10
    }));
    worksheet['!cols'] = colWidths;

    // 워크시트를 워크북에 추가
    XLSX.utils.book_append_sheet(workbook, worksheet, 'KT사이트 성능측정 결과');

    // 파일명 생성 (날짜시간 포함)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `KT사이트_성능측정결과_${timestamp}.xlsx`;
    const filepath = path.join(process.cwd(), filename);

    // 엑셀 파일 저장
    XLSX.writeFile(workbook, filepath);

    const endTime = new Date();
    const duration = Math.round((endTime - this.startTime) / 1000);

    console.log(`✅ 엑셀 리포트 생성 완료!`);
    console.log(`📁 파일 경로: ${filepath}`);
    console.log(`⏱️  총 소요 시간: ${Math.floor(duration / 60)}분 ${duration % 60}초`);
    
    // 결과 요약 출력
    this.printSummary();
  }

  // 결과 요약 출력
  printSummary() {
    console.log('\n📊 측정 결과 요약:');
    console.log('═'.repeat(80));
    
    TARGET_URLS.forEach(site => {
      console.log(`\n🌐 ${site.name}`);
      
      const noCacheResult = this.results.find(r => r.siteName === site.name && r.cacheStatus === '캐시 없음');
      const withCacheResult = this.results.find(r => r.siteName === site.name && r.cacheStatus === '캐시 있음');

      console.log('   캐시 없음:', this.formatMetrics(noCacheResult?.averages));
      console.log('   캐시 있음:', this.formatMetrics(withCacheResult?.averages));
    });
    
    console.log('\n🎉 모든 측정이 완료되었습니다!');
  }

  formatMetrics(metrics) {
    if (!metrics) return '측정 실패';
    return `FCP=${metrics.FCP}ms, LCP=${metrics.LCP}ms, TBT=${metrics.TBT}ms, CLS=${metrics.CLS}, SI=${metrics.SI}ms`;
  }
}

// 메인 실행 함수
async function main() {
  console.log('🔍 [DEBUG] main() 함수 시작');
  console.log('🔍 시작 전 환경 확인...');
  
  try {
    console.log('🔍 [DEBUG] PerformanceAnalyzer 생성자 시작');
    const analyzer = new PerformanceAnalyzer();
    console.log('🔍 [DEBUG] analyzer.runFullAnalysis() 호출 중...');
    await analyzer.runFullAnalysis();
  } catch (error) {
    console.error('💥 실행 중 오류 발생:', error.message);
    console.error('📋 오류 상세:', error.stack);
    process.exit(1);
  }
}

// CLI에서 직접 실행되었을 때만 main 함수 실행
if (require.main === module) {
  console.log('🔍 [DEBUG] CLI에서 직접 실행됨, main() 호출');
  main();
} else {
  console.log('🔍 [DEBUG] 모듈로 import됨, main() 호출하지 않음');
}

console.log('🔍 [DEBUG] main() 함수 정의 완료, 실행 여부 확인 중...');
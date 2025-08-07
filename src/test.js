// src/test.js
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const fs = require('fs-extra');

async function testLighthousePackage() {
  console.log('🧪 Lighthouse 패키지 방식 테스트 (안정 버전)');
  console.log('📦 사용 버전: lighthouse@9.6.8');
  
  let chrome = null;
  
  try {
    // Chrome 실행
    console.log('🚀 Chrome 실행 중...');
    chrome = await chromeLauncher.launch({
      chromeFlags: [
        '--headless',
        '--no-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-extensions'
      ]
    });
    
    console.log(`✅ Chrome 실행 완료 (포트: ${chrome.port})`);
    
    // Lighthouse 옵션
    const options = {
      logLevel: 'info',
      output: 'json',
      onlyCategories: ['performance'],
      port: chrome.port,
      disableDeviceEmulation: true,
      maxWaitForFcp: 30 * 1000,
      maxWaitForLoad: 45 * 1000
    };
    
    console.log('📊 Google.com 성능 측정 중... (약 30초)');
    const runnerResult = await lighthouse('https://www.google.com', options);
    
    if (!runnerResult || !runnerResult.lhr) {
      throw new Error('Lighthouse 결과가 없습니다');
    }
    
    const lhr = runnerResult.lhr;
    const performanceScore = Math.round(lhr.categories.performance.score * 100);
    
    console.log(`✅ 측정 완료! 성능 점수: ${performanceScore}점`);
    
    // 5개 핵심 메트릭 추출
    const audits = lhr.audits;
    const metrics = {
      FCP: Math.round(audits['first-contentful-paint'].numericValue),
      LCP: Math.round(audits['largest-contentful-paint'].numericValue),
      TBT: Math.round(audits['total-blocking-time'].numericValue),
      CLS: parseFloat(audits['cumulative-layout-shift'].numericValue.toFixed(3)),
      SI: Math.round(audits['speed-index'].numericValue)
    };
    
    console.log('📊 5개 핵심 메트릭:');
    console.log(`   ● FCP (첫 내용 등장): ${metrics.FCP}ms`);
    console.log(`   ● LCP (메인 내용 완성): ${metrics.LCP}ms`);
    console.log(`   ● TBT (반응 안하는 시간): ${metrics.TBT}ms`);
    console.log(`   ● CLS (화면 흔들림): ${metrics.CLS}`);
    console.log(`   ● SI (전체 완성 속도): ${metrics.SI}ms`);
    
    console.log('🎉 패키지 방식 성공! KT 사이트 측정 준비 완료');
    return { success: true, metrics };
    
  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
    if (error.stack) {
      console.error('스택 트레이스:', error.stack);
    }
    return { success: false, error: error.message };
    
  } finally {
    if (chrome) {
      await chrome.kill();
      console.log('🔄 Chrome 종료 완료');
    }
  }
}

// 실행
testLighthousePackage()
  .then(result => {
    if (result.success) {
      console.log('\n✨ 환경 구축 완료! 이제 KT 사이트 측정으로 진행 가능');
      process.exit(0);
    } else {
      console.log('\n💥 환경 구축 실패');
      process.exit(1);
    }
  });
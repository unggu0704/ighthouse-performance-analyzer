// modules/ReportGenerator.js - Excel 리포트 생성
const ExcelJS = require('exceljs');
const path = require('path');
const config = require('../config');

class ReportGenerator {
    constructor() {
        this.workbook = new ExcelJS.Workbook();
    }

    async generateExcelReport(allResults) {
        try {
            console.log('📊 Excel 리포트 생성 중...');
            
            const worksheet = this.workbook.addWorksheet('성능 측정 결과');
            
            // 헤더 설정
            this.setupHeaders(worksheet);
            
            // 데이터 추가
            this.addDataRows(worksheet, allResults);
            
            // 스타일 적용
            this.applyStyles(worksheet);
            
            // 파일 저장
            const filename = this.generateFilename();
            const filepath = path.join(process.cwd(), filename);
            
            await this.workbook.xlsx.writeFile(filepath);
            console.log(`✅ Excel 리포트 생성 완료: ${filename}`);
            
            return filepath;
            
        } catch (error) {
            console.error('❌ Excel 리포트 생성 실패:', error);
            throw error;
        }
    }

    setupHeaders(worksheet) {
        const headers = [
            '사이트명',
            '캐시 상태',
            'FCP (ms)',
            'LCP (ms)', 
            'TBT (ms)',
            'CLS',
            'SI (ms)'
        ];

        worksheet.columns = headers.map((header, index) => ({
            header,
            key: this.getColumnKey(index),
            width: this.getColumnWidth(header)
        }));
    }

    addDataRows(worksheet, allResults) {
        allResults.forEach(siteResult => {
            const siteName = siteResult.siteName;
            
            // 캐시 없음 데이터
            worksheet.addRow({
                A: siteName,
                B: '캐시 없음',
                C: siteResult.noCache.fcp,
                D: siteResult.noCache.lcp,
                E: siteResult.noCache.tbt,
                F: siteResult.noCache.cls,
                G: siteResult.noCache.si
            });
            
            // 캐시 있음 데이터
            worksheet.addRow({
                A: siteName,
                B: '캐시 있음',
                C: siteResult.withCache.fcp,
                D: siteResult.withCache.lcp,
                E: siteResult.withCache.tbt,
                F: siteResult.withCache.cls,
                G: siteResult.withCache.si
            });
        });
    }

    applyStyles(worksheet) {
        // 헤더 스타일
        const headerRow = worksheet.getRow(1);
        headerRow.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE6F3FF' }
            };
            cell.font = {
                bold: true,
                size: 12
            };
            cell.alignment = {
                horizontal: 'center',
                vertical: 'middle'
            };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        // 데이터 행 스타일
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1) {
                row.eachCell((cell, colNumber) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                    
                    // 숫자 컬럼은 우측 정렬
                    if (colNumber > 2) {
                        cell.alignment = { horizontal: 'right' };
                        cell.numFmt = colNumber === 6 ? '0.000' : '0'; // CLS는 소수점 3자리
                    } else {
                        cell.alignment = { horizontal: 'center' };
                    }
                    
                    // 캐시 있음/없음에 따른 배경색
                    const cacheStatus = row.getCell(2).value;
                    if (cacheStatus === '캐시 없음') {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFFFEEE6' }
                        };
                    } else if (cacheStatus === '캐시 있음') {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFE6FFE6' }
                        };
                    }
                });
            }
        });

        // 자동 높이 조정
        worksheet.eachRow((row) => {
            row.height = 25;
        });
    }

    getColumnKey(index) {
        return String.fromCharCode(65 + index); // A, B, C, ...
    }

    getColumnWidth(header) {
        const widths = {
            '사이트명': 20,
            '캐시 상태': 12,
            'FCP (ms)': 12,
            'LCP (ms)': 12,
            'TBT (ms)': 12,
            'CLS': 10,
            'SI (ms)': 12
        };
        return widths[header] || 15;
    }

    generateFilename() {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '_');
        return `${config.REPORT_FILENAME}_${dateStr}.xlsx`;
    }

    // 간단한 콘솔 리포트도 생성
    generateConsoleReport(allResults) {
        console.log('\n📊 ===== 성능 측정 결과 요약 =====');
        
        allResults.forEach((siteResult, index) => {
            console.log(`\n${index + 1}. ${siteResult.siteName}`);
            console.log(`   📍 URL: ${siteResult.url}`);
            
            console.log('   🚫 캐시 없음:');
            this.printMetrics(siteResult.noCache);
            
            console.log('   ✅ 캐시 있음:');
            this.printMetrics(siteResult.withCache);
        });
        
        console.log('\n✅ 전체 성능 측정 완료!');
    }

    printMetrics(metrics) {
        console.log(`      FCP: ${metrics.fcp}ms, LCP: ${metrics.lcp}ms, TBT: ${metrics.tbt}ms, CLS: ${metrics.cls}, SI: ${metrics.si}ms`);
    }
}

module.exports = ReportGenerator;
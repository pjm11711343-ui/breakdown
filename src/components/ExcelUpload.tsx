
import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { SpecItem } from '../types';

interface Props {
  onDataLoaded: (items: SpecItem[], workbook: XLSX.WorkBook) => void;
  variant?: 'button' | 'dropzone';
}

export default function ExcelUpload({ onDataLoaded, variant = 'button' }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();

    reader.onerror = () => {
      setIsProcessing(false);
      alert('파일을 읽는 중 오류가 발생했습니다.');
    };

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, {
          type: 'binary',
          cellStyles: true,
          cellFormula: true,
          cellNF: true,
          sheetStubs: true
        });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (!data || data.length === 0) {
          throw new Error('데이터가 없거나 잘못된 형식입니다.');
        }

        // Find the header row by looking for the row with the most keyword matches
        let headerRowIndex = -1;
        let headers: string[] = [];
        let maxMatches = 0;
        const constructionKeywords = ['품명', '규격', '수량', '단위', '단가', '금액', '명칭', '비고', '재료비', '노무비', '경비', '합계'];
        
        for (let i = 0; i < Math.min(data.length, 40); i++) {
          const rowData = data[i];
          if (!rowData || !Array.isArray(rowData)) continue;
          
          const rowStr = rowData.map(c => String(c || '').replace(/\s+/g, '').toLowerCase());
          const matches = rowStr.filter(c => constructionKeywords.some(k => c.includes(k))).length;
          
          // We need a minimum of 2 matches to consider it a real header row
          if (matches > maxMatches && matches >= 2) {
            maxMatches = matches;
            headerRowIndex = i;
          }
        }

        // If no row found with multiple matches, fallback to the previous simple logic but check all rows first
        if (headerRowIndex === -1) {
          for (let i = 0; i < Math.min(data.length, 40); i++) {
            const rowData = data[i];
            if (!rowData || !Array.isArray(rowData)) continue;
            const rowStr = rowData.map(c => String(c || '').replace(/\s+/g, '').toLowerCase());
            if (rowStr.some(c => c.includes('품명') || c.includes('규격') || c.includes('수량') || c.includes('명칭') || c.includes('단위'))) {
              headerRowIndex = i;
              break;
            }
          }
        }

        if (headerRowIndex !== -1) {
          const i = headerRowIndex;
          const rowData = data[i];
          
          // Check the row ABOVE for category headers (e.g., "재료비", "노무비")
          const prevRow = i > 0 ? (data[i - 1] as any[]) : null;
          const currentRow = rowData;
          const maxCols = Math.max(currentRow.length, prevRow ? prevRow.length : 0);
          headers = new Array(maxCols).fill('');

          // If there's a previous row, it might contain merged category names
          let lastParentCategory = '';
          for (let colIdx = 0; colIdx < maxCols; colIdx++) {
            const prevVal = prevRow && prevRow[colIdx] ? String(prevRow[colIdx]).trim() : '';
            // If the top cell has value, it's a new category. 
            // Also handle merged cells where the value is only in the first cell of the merge range.
            if (prevVal && prevVal.length > 1) {
              lastParentCategory = prevVal;
            }
            
            const currentVal = String(currentRow[colIdx] || '').trim();
            const cleanCurrent = currentVal.replace(/\s+/g, '');
            const cleanParent = lastParentCategory.replace(/\s+/g, '');
            
            // Map specific sub-headers to their categories for better identification
            const isSubHeader = cleanCurrent.includes('단가') || cleanCurrent.includes('금액') || cleanCurrent.includes('단고') || cleanCurrent.includes('계');
            
            if (lastParentCategory && isSubHeader) {
              headers[colIdx] = `${lastParentCategory} ${currentVal}`;
            } else if (cleanParent.includes('재료비') || cleanParent.includes('노무비') || cleanParent.includes('자재비') || cleanParent.includes('인건비') || cleanParent.includes('합계') || cleanParent.includes('단가')) {
              headers[colIdx] = currentVal ? `${lastParentCategory} ${currentVal}` : lastParentCategory;
            } else {
              headers[colIdx] = currentVal || lastParentCategory;
            }
          }

          // Look at the next row for even more sub-headers
          const nextRow = data[i + 1] as any[];
          if (nextRow && Array.isArray(nextRow)) {
            nextRow.forEach((val, colIdx) => {
              if (colIdx >= headers.length) return;
              const s = String(val || '').trim();
              if (s && ['단가', '금액', '합계', '수량', '단위', '규격', '비고'].some(k => s.includes(k))) {
                if (headers[colIdx] && !headers[colIdx].includes(s)) {
                  headers[colIdx] = `${headers[colIdx]} ${s}`;
                } else if (!headers[colIdx]) {
                  headers[colIdx] = s;
                }
              }
            });
          }
        }

        if (headerRowIndex === -1) {
          throw new Error('유효한 테이블 헤더를 찾을 수 없습니다.');
        }

        // Map columns with expanded keyword lists
        const getColIdx = (keywords: string[]) => {
          return headers.findIndex(h => {
            if (!h) return false;
            const cleanH = h.replace(/\s+/g, '').toLowerCase();
            return keywords.some(k => cleanH.includes(k.replace(/\s+/g, '').toLowerCase()));
          });
        };

        const nameKeywords = [
          '품명', '항목', '공종', '명칭', '구분', '항목명', '내용', '자재명', '비목', '세부공종', '목', '자재', '공사명', '공 사 명', '품 명', '품   명', 
          'ITEM', 'DESCRIPTION', '세부항목', '자재내역', '품목', '공 명', '공종(품명)', '공종/품명'
        ];
        const specKeywords = [
          '규격', '상세', '사양', '규격및', '도면번호', '규격및사양', '형식', '규 격', '사 양', 'dimensions', 'size', 'spec', 'description', 
          '형명', '모델', 'model', '모델명', '규격(사양)', '규격사항', '품명(규격)', '품명/규격', '규격/사양', '규격 및 상세', '규격동', '동규격', 
          '규격·사양', 'SPECIFICATION', 'MODEL', '규격 및 사양', '규격(동)', '규격·동', '규격(특기사항)', '규격·사양·형식', 'TYPE/SIZE', 'DIMENSION',
          '사각', '두께', '재질'
        ];
        const unitKeywords = ['단위', '단 위', 'unit', '단  위', '단   위', 'UNIT', 'U/T', '단   위'];
        const qtyKeywords = ['수량', '설계수량', 'qty', 'quantity', '기성수량', '검측수량', '공수', '설계', '수 량', '합계수량', '실수량', '분량', '정미수량', '수  량', '수   량', 'QUANTITY', 'QTY', '수  료', '설계 수량'];

        const mPriceKeywords = ['재료비단가', '재료단가', '자재단가', '재료비단고', '자제비단가', '자재비단가', '재료비 단가', '자재비 단가', '재료 단가', '자재 단가', '재료비합계 단가', '재료비합계단가', '재료비(단가)', '재료단가(원)', 'MAT. UNIT PRICE', 'M/P', '자재비 단가'];
        const mAmountKeywords = ['재료금액', '재료비금액', '재료비합계', '자재금액', '자재비금액', '자재비계', '재료비 합계', '자재비 합계', '재료비계', '재료비 합계금액', '재료비(금액)', 'MAT. AMOUNT', 'M/A', '자재비 합계'];

        const lPriceKeywords = ['노무비단가', '노무단가', '인건비단가', '노무비단고', '인건비 단가', '노무단 가', '노무비 단가', '인건비단가', '직접노무비', '직노단가', '노무비합계 단가', '노무비합계단가', '노무비(단가)', '노무단가(원)', 'LAB. UNIT PRICE', 'L/P', '인건비 단가'];
        const lAmountKeywords = ['노무비금액', '노무금액', '노무비합계', '노무비계', '노무액', '인건비합계', '노무비 합계', '인건비 합계', '직접노무비금액', '노무비계', '노무비 합계금액', '노무비(금액)', 'LAB. AMOUNT', 'L/A', '인건비 합계'];

        const totalPriceKeywords = ['합계단가', '단가', '단 가', '단 고', '계단가', '총단가', '단가합계', '단 가 계', '종합단가', '합 계 단 가', 'TOTAL PRICE', 'UNIT PRICE', '단가계'];
        const totalAmountKeywords = ['금액합계', '합계금액', '금액', '합계', '계', '총액', '소계', '공사금액', '금 액', '합계금액', '합 계 금 액', 'TOTAL AMOUNT', 'TOTAL', '금액계'];

        const remarkKeywords = ['비고', '산출근거', '비 고', '특기사항', '적요', 'REMARK', 'NOTES', '관련근거'];

        const nameIdx = getColIdx(nameKeywords);
        let specIdx = getColIdx(specKeywords);
        const unitIdx = getColIdx(unitKeywords);
        const qtyIdx = getColIdx(qtyKeywords);

        // Advanced Fallback Logic for Specification Column:
        // Construction excels often place "Spec" right after "Name".
        // We scan up to 3 columns after the "Name" column to find a suitable "Spec" candidate.
        if (nameIdx !== -1 && specIdx === -1) {
          for (let i = 1; i <= 3; i++) {
            const checkIdx = nameIdx + i;
            if (checkIdx < headers.length) {
              const h = headers[checkIdx].toLowerCase().replace(/\s+/g, '');
              // A good specimen column is NOT another known mandatory column
              const isOtherKey = [...unitKeywords, ...qtyKeywords, ...totalPriceKeywords, ...totalAmountKeywords]
                .some(k => h.includes(k.replace(/\s+/g, '').toLowerCase()));
              
              if (!isOtherKey && h.length > 0) {
                specIdx = checkIdx;
                break;
              }
            }
          }
        }
        
        // Final fallback: if spec is still -1 but unit is far away from name, assume middle is spec
        if (specIdx === -1 && nameIdx !== -1 && unitIdx > nameIdx + 1) {
          specIdx = nameIdx + 1;
        }
        
        const materialPriceIdx = getColIdx(mPriceKeywords);
        const materialAmountIdx = getColIdx(mAmountKeywords);
        
        const laborPriceIdx = getColIdx(lPriceKeywords);
        const laborAmountIdx = getColIdx(lAmountKeywords);
        
        const priceIdx = getColIdx(totalPriceKeywords);
        const amountIdx = getColIdx(totalAmountKeywords);
        
        const remarkIdx = getColIdx(remarkKeywords);

        // Refined Fallback Logic: Detect material/labor price columns if not explicitly named
        // Construction Excels often have 3 pairs of Price/Amount: Material, Labor, and Subtotal
        const allPriceIndices = headers.map((h, idx) => ({ h: h.replace(/\s+/g, '').toLowerCase(), idx }))
          .filter(item => item.h.includes('단가') || item.h === '단고' || item.h.includes('unitprice') || item.h === 'price' || item.h.includes('단가계') || item.h.includes('u/p'))
          .map(item => item.idx);
        
        const finalMaterialPriceIdx = materialPriceIdx !== -1 ? materialPriceIdx : (allPriceIndices.length >= 1 ? allPriceIndices[0] : -1);
        const finalLaborPriceIdx = laborPriceIdx !== -1 ? laborPriceIdx : (allPriceIndices.length >= 2 ? allPriceIndices[1] : -1);
        const finalPriceIdx = priceIdx !== -1 ? priceIdx : (allPriceIndices.length >= 3 ? allPriceIndices[2] : (allPriceIndices.length === 1 ? allPriceIndices[0] : (allPriceIndices.length >= 1 ? allPriceIndices[allPriceIndices.length - 1] : -1)));

        const allAmountIndices = headers.map((h, idx) => ({ h: h.replace(/\s+/g, '').toLowerCase(), idx }))
          .filter(item => item.h.includes('금액') || item.h === '계' || item.h.includes('amount') || item.h === '금액합계' || item.h === '합계')
          .map(item => item.idx);
        
        const finalMaterialAmountIdx = materialAmountIdx !== -1 ? materialAmountIdx : (allAmountIndices.length >= 1 ? allAmountIndices[0] : -1);
        const finalLaborAmountIdx = laborAmountIdx !== -1 ? laborAmountIdx : (allAmountIndices.length >= 2 ? allAmountIndices[1] : -1);
        const finalAmountIdx = amountIdx !== -1 ? amountIdx : (allAmountIndices.length >= 3 ? allAmountIndices[2] : (allAmountIndices.length === 1 ? allAmountIndices[0] : -1));

        let currentSection = '기본 내역';
        const items: SpecItem[] = [];

        // Determine critical indices with fallbacks
        const effectiveNameIdx = nameIdx !== -1 ? nameIdx : headers.findIndex(h => h.includes('품명')) !== -1 ? headers.findIndex(h => h.includes('품명')) : 1; 
        const effectiveQtyIdx = qtyIdx !== -1 ? qtyIdx : headers.findIndex(h => h.includes('수량')) !== -1 ? headers.findIndex(h => h.includes('수량')) : -1;

        // Check if the next row is a sub-header row to skip it during data processing
        let actualDataStartIndex = headerRowIndex + 1;
        const potentialSubHeaderRow = data[headerRowIndex + 1];
        if (potentialSubHeaderRow && Array.isArray(potentialSubHeaderRow)) {
          const nextRowStr = potentialSubHeaderRow.map(c => String(c || '').replace(/\s+/g, '').toLowerCase());
          const subHeaderKeywords = ['단위', '수량', '단가', '금액', '합계', '비고', '재료비', '노무비'];
          const matches = nextRowStr.filter(s => subHeaderKeywords.some(k => s.includes(k)));
          if (matches.length >= 3) { // Use higher threshold to avoid skipping data rows
            actualDataStartIndex = headerRowIndex + 2;
          }
        }

        const rows = data.slice(actualDataStartIndex);

        // Find optimal name column if not explicitly defined
        let finalNameIdx = nameIdx;
        if (finalNameIdx === -1) {
          // Pick the first column that usually contains names (likely Col 1 or 2, skipped if it looks like No.)
          for (let c = 0; c < headers.length; c++) {
            const h = headers[c] ? headers[c].toLowerCase() : '';
            if (h.includes('no') || h.includes('번호') || h.includes('순번')) continue;
            if (c !== unitIdx && c !== qtyIdx && c !== finalPriceIdx && c !== finalAmountIdx) {
              finalNameIdx = c;
              break;
            }
          }
        }
        if (finalNameIdx === -1) finalNameIdx = 1; // Last resort

        rows.forEach((row, idx) => {
          if (!row || !Array.isArray(row) || row.length === 0) return;

          const getValue = (colIdx: number) => {
            if (colIdx < 0 || colIdx >= row.length) return '';
            const val = row[colIdx];
            return val === undefined || val === null ? '' : String(val).trim();
          };

          let name = getValue(finalNameIdx);
          if (!name || name === 'null' || name === 'undefined' || name === '0' || name === '합계') return;

          // Skip obvious total rows or artifacts
          const cleanName = name.replace(/\s+/g, '');
          if (cleanName.includes('[합') || cleanName === '계' || cleanName.startsWith('Total') || cleanName.includes('페이지') || cleanName.includes('SubTotal')) return;

          let spec = getValue(specIdx);
          
          // Handle split Name/Spec in one field or column
          if (name && !spec && (name.includes('(') || name.includes('/') || name.includes('['))) {
             // Try to extract spec from name if spec column is missing
             const match = name.match(/^(.*?)[(/[](.*?)[)\]]?$/);
             if (match) {
               name = match[1].trim();
               spec = match[2].trim();
             }
          }

          const unit = getValue(unitIdx);
          const qtyStr = getValue(qtyIdx !== -1 ? qtyIdx : -1); // use qtyIdx directly
          const mPriceStr = getValue(finalMaterialPriceIdx);
          const mAmountStr = getValue(finalMaterialAmountIdx);
          const lPriceStr = getValue(finalLaborPriceIdx);
          const lAmountStr = getValue(finalLaborAmountIdx);
          const priceStr = getValue(finalPriceIdx);
          const amountStr = getValue(finalAmountIdx);
          const remark = getValue(remarkIdx);

          const cleanNum = (s: string) => {
            if (!s) return 0;
            // Handle scientific notation or weird formats
            const n = parseFloat(s.replace(/,/g, '').replace(/[^\d.-]/g, ''));
            return isNaN(n) ? 0 : n;
          };

          const qtyValue = cleanNum(qtyStr);
          let mPriceValue = cleanNum(mPriceStr);
          let lPriceValue = cleanNum(lPriceStr);
          const mAmountValue = cleanNum(mAmountStr);
          const lAmountValue = cleanNum(lAmountStr);

          // Derive unit prices if missing but amounts are present
          if (mPriceValue === 0 && mAmountValue !== 0 && qtyValue > 0) {
            mPriceValue = mAmountValue / qtyValue;
          }
          if (lPriceValue === 0 && lAmountValue !== 0 && qtyValue > 0) {
            lPriceValue = lAmountValue / qtyValue;
          }

          let priceValue = cleanNum(priceStr);
          const amountValue = cleanNum(amountStr);

          // If sub-total price is missing but we have material/labor, sum them
          if (priceValue === 0 && (mPriceValue !== 0 || lPriceValue !== 0)) {
            priceValue = mPriceValue + lPriceValue;
          }
          // Conversely, if total price exists but material/labor unit prices are 0, and we have material/labor amounts
          // we could potentially derive unit prices if needed, but usually the Excel has them.

          const hasQty = qtyValue !== 0;
          const hasPrice = priceValue !== 0 || mPriceValue !== 0 || lPriceValue !== 0;
          const hasAmount = amountValue !== 0;
          const hasNumericData = hasQty || hasPrice || hasAmount;

          // Section Detection Logic - more aggressive to find titles
          const isNumericTitle = /^\d+(\.\d+)*$/.test(name);
          const isSymbolSection = name.startsWith('∼') || name.startsWith('■') || name.startsWith('□') || name.startsWith('○') || name.startsWith('第');
          const isHeaderStyle = !hasNumericData && (name.length > 2 && (!unit || unit.length > 2));
          
          if (isHeaderStyle || isNumericTitle || isSymbolSection) {
            // Also ensure it's not actually an item with missing numeric data
            if (!hasNumericData && !unit) {
              currentSection = name;
              return;
            }
          }

          // Custom Categorization Logic based on user request
          let autoCategory = '';
          const lowerName = name.toLowerCase();
          const lowerSection = currentSection.toLowerCase();
          
          if (lowerName.includes('배관용탄소강관')) {
            autoCategory = '백강관';
          } else if (lowerName.includes('기계터파기') || lowerName.includes('기계되메우기') || lowerName.includes('모래부설')) {
            autoCategory = '기타자재';
          } else if (lowerName.includes('압력계설치') || lowerName.includes('부동급수전')) {
            autoCategory = '밸브류';
          } else if (lowerName.includes('녹막이페인트칠')) {
            autoCategory = '소모잡자재';
          } else if (lowerName.includes('보일러하부배관고정크램프')) {
            autoCategory = '마감자재';
          } else if (lowerName.includes('플랜지')) {
            if (spec.toLowerCase().includes('pvc')) {
              autoCategory = 'PVC';
            } else {
              autoCategory = '강관부속';
            }
          } else if (lowerName.includes('기계실 잡철물') || lowerName.includes('ㄱ형강')) {
            autoCategory = '조립식가대';
          } else if (lowerName.includes('수도용앵글밸브') || lowerName.includes('세대역류방지밸브')) {
            autoCategory = '통합거치대';
          } else if (lowerName.includes('원형수전브라켓')) {
            autoCategory = 'PB';
          } else if (lowerSection.includes('기계실환기덕트')) {
            const outsourcingKeywords = [
              '각형덕트', '캔버스', '점검구', '동망', '유성페인트', '녹막이페인트',
              'B.D.D', 'GRILLE', 'F.D', 'REGISTER', '노무비'
            ];
            if (outsourcingKeywords.some(k => lowerName.includes(k.toLowerCase()))) {
              autoCategory = '외주';
            }
          } else if (lowerName.includes('공구손료')) {
            const outsourcingSections = [
              '부대시설전열교환기공사',
              '부대시설환기덕트설치공사',
              '근생환기덕트설치공사',
              '전열교환기 설치공사',
              '기계실환기덕트설치공사'
            ];
            if (outsourcingSections.some(sec => lowerSection.includes(sec.toLowerCase()))) {
              autoCategory = '외주';
            } else {
              autoCategory = '공구손료';
            }
          } else if (lowerSection.includes('단위세대')) {
            const s = spec.toLowerCase().replace(/\s+/g, '');
            if (lowerSection.includes('난방배관공사') || lowerSection.includes('01010401') || lowerSection.includes('01010405') || lowerSection.includes('세대내배관공사')) {
              if (lowerName.includes('폴리부틸렌관')) {
                autoCategory = 'PB';
              } else if (lowerName.includes('목긴볼밸브')) {
                autoCategory = '밸브류';
              }
            }
            
            if (!autoCategory && lowerSection.includes('난방배관공사')) {
              if (lowerName.includes('폴리부틸렌관') && (s.includes('pb엘보d20') || s.includes('pbf밸브소켓d20') || s.includes('pbm밸브소켓d20'))) {
                autoCategory = 'PB';
              } else if (lowerName.includes('목긴볼밸브') && s.includes('황동,10kg,d20')) {
                autoCategory = '밸브류';
              }
            }
            
            if (!autoCategory) {
              if (lowerName.includes('폴리부틸렌관') && s.includes('pb관') && (s.includes('난방용') || s.includes('위생용')) && s.includes('d15')) {
                autoCategory = '난방코일';
              } else if (lowerName.includes('폴리부틸렌관') && (s.includes('pb관') && (s.includes('난방용') || s.includes('위생용')) && s.includes('d20') || s.includes('pb서포트스리브'))) {
                autoCategory = 'PB';
              } else if (
                lowerName.includes('sts강관이음쇠') || 
                lowerName.includes('폴리부틸렌관') || 
                lowerName.includes('폴리부틸렌') || 
                lowerName.includes('pb') || 
                lowerName.includes('목긴볼밸브') || 
                lowerName.includes('통합거치대') ||
                lowerName.includes('분기관') ||
                lowerName.includes('압력계') ||
                lowerName.includes('수도계량기') ||
                lowerName.includes('링죠인트') ||
                lowerName.includes('리듀서') ||
                s.includes('pb엘보') ||
                s.includes('pb티이') ||
                s.includes('pb수전엘보') ||
                s.includes('pbf밸브소켓') ||
                s.includes('pbm밸브소켓') ||
                lowerName.includes('세대일체형브라켓')
              ) {
                autoCategory = '통합거치대';
              }
            }
          } else if (lowerName.includes('폴리부틸렌관') || spec.toLowerCase().includes('pb서포트스리브')) {
            autoCategory = 'PB';
          } else if (lowerName.includes('강관스리브') || lowerName.includes('pvc스리브') || lowerName.includes('볼텍스') || lowerName.includes('이중배관소켓') || (spec.toLowerCase().includes('스리브') && !spec.toLowerCase().includes('pb서포트스리브'))) {
            autoCategory = '스리브';
          } else if (lowerSection.includes('주차장환기덕트설치공사')) {
            if (lowerName.includes('유성페인트') || lowerName.includes('녹막이페인트')) {
              autoCategory = '외주';
            }
          } else if (lowerName.includes('멀티캡')) {
            autoCategory = '마감자재';
          } else if (lowerName.includes('난연이중크린호스y분기관')) {
            autoCategory = '외주';
          } else if (lowerName.includes('시스템가대브라켓') || lowerName.includes('조립식찬넬설치공사') || lowerName.includes('시스템찬넬')) {
            autoCategory = '조립식가대';
          } else if (lowerSection.includes('조립식찬넬설치공사') && lowerName.includes('그외부속류')) {
            autoCategory = '조립식가대';
          } else if (lowerName.includes('무용접스텐')) {
            if (lowerName.includes('난방') || lowerSection.includes('난방')) {
              autoCategory = 'STS난방부속';
            } else {
              autoCategory = 'STS위생부속';
            }
          } else if (lowerName.includes('스텐관용접')) {
            if (lowerName.includes('난방') || lowerSection.includes('난방')) {
              autoCategory = 'STS난방부속';
            } else {
              autoCategory = 'STS위생부속';
            }
          }

          // If it has a name and at least one characteristic of a real item
          if (name && (hasNumericData || unit || spec)) {
            items.push({
              id: `excel-${idx}-${Date.now()}`,
              name,
              specification: spec,
              unit,
              quantity: qtyValue,
              materialUnitPrice: mPriceValue,
              materialAmount: mAmountValue || (qtyValue * mPriceValue),
              laborUnitPrice: lPriceValue,
              laborAmount: lAmountValue || (qtyValue * lPriceValue),
              unitPrice: priceValue,
              amount: amountValue || (qtyValue * priceValue),
              category: autoCategory,
              section: currentSection,
              remark: (remark === 'null' || remark === 'undefined') ? '' : remark,
              excelRowIdx: actualDataStartIndex + idx
            });
          }
        });

        if (items.length === 0) {
          throw new Error('불러올 수 있는 내역 데이터가 없습니다.');
        }

        onDataLoaded(items, wb);
      } catch (error: any) {
        console.error('Excel processing error:', error);
        alert(`업로드 실패: ${error.message}`);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  if (variant === 'dropzone') {
    return (
      <div 
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`w-full h-64 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-4 transition-all bg-white group ${
          isProcessing ? 'border-indigo-300 bg-indigo-50 cursor-wait' : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50 cursor-pointer'
        }`}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept=".xlsx, .xls"
          onChange={handleFileUpload}
          disabled={isProcessing}
        />
        <div className={`p-4 rounded-full transition-transform ${isProcessing ? 'bg-white shadow-sm' : 'bg-indigo-50 group-hover:scale-110'}`}>
          {isProcessing ? (
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          ) : (
            <Upload className="w-8 h-8 text-indigo-600" />
          )}
        </div>
        <div className="text-center px-4">
          <p className="text-slate-900 font-bold">
            {isProcessing ? '파일 데이터를 정밀 분석 중입니다' : '엑셀 계약 내역서 업로드'}
          </p>
          <p className="text-slate-400 text-sm mt-1 max-w-xs">
            {isProcessing ? '대용량 파일의 경우 수 초가 걸릴 수 있습니다.' : '파일을 드래그하거나 클릭하여 시작하세요'}
          </p>
        </div>
        {!isProcessing && (
          <div className="mt-4 flex gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-indigo-400" /> Auto Detection</span>
            <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-indigo-400" /> AI Ready</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept=".xlsx, .xls"
        onChange={handleFileUpload}
        disabled={isProcessing}
      />
      <button 
        onClick={() => fileInputRef.current?.click()}
        disabled={isProcessing}
        className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-all shadow-sm text-sm font-medium ${
          isProcessing 
            ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-wait' 
            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
        }`}
      >
        {isProcessing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Upload className="w-4 h-4" />
        )}
        {isProcessing ? '처리 중...' : '내역서 업로드'}
      </button>
    </>
  );
}

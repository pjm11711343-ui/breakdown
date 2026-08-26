import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API endpoint for classification
  app.post('/api/classify', async (req, res) => {
    try {
      const { items, categories, customRules } = req.body;
      if (!items || !Array.isArray(items)) {
        return res.status(400).json({ error: 'Items must be an array' });
      }

      if (items.length === 0) {
        return res.json([]);
      }

      // Pre-classification with local rules (Sync with src/utils/classifier.ts)
      const MAPPING_RULES: Record<string, string> = {
        '고강도 PVC관': '고강도PVC', '고강도PVC이음관': '고강도PVC', 'DH관': '고강도PVC',
        '폴리부틸렌관': 'PB', '합성수지제가요전선관': 'PB', '소음방지링': 'PB', '실링캡': 'PB', '관말캡': 'PB', 'MP박스': 'PB',
        '일반용경질염화비닐관': 'PVC', '배수용경질염화비닐이음관': 'PVC', 'DRF-X': 'PVC', 'VENT 캡': 'PVC', 'PVC스리브': 'PVC',
        '배관용스테인리스강관': 'STS위생관', '일반배관용스테인리스강관': 'STS위생관', 'STS 위생관': 'STS위생관',
        '일반배관용STS강관이음쇠': 'STS위생부속', 'STS 위생부속': 'STS위생부속', '무용접스텐엘보': 'STS위생부속', '무용접스텐티이': 'STS위생부속', '무용접스텐리듀서': 'STS위생부속', '무용접스텐캡': 'STS위생부속', '무용접스텐플랜지아답타': 'STS위생부속',
        '일반행거': 'SUPPORT류', '절연행가': 'SUPPORT류', 'U자형볼트': 'SUPPORT류', '인서트플레이트': 'SUPPORT류', '달대볼트': 'SUPPORT류',
        '감압밸브': '감압변', '세대별물감압밸브': '감압변',
        '용접식관이음쇠': '강관부속', '무용접엘보': '강관부속', '무용접티이': '강관부속', '무용접플랜지아답타니플': '강관부속', '무용접고정식커플링': '강관부속', '강관용접': '강관부속', '용접합후렌지': '강관부속',
        '일체형 고정 틀': '입상고정틀+내화충진재',
        '온수분배기': '난방분배기', '온도조절밸브': '난방분배기', '구동기': '난방분배기', '씽크수전지지대': '난방분배기', '유니온엘보': '난방분배기',
        '코일고정U핀': '난방코일', 'FLOORPANEL': '난방코일',
        '내화충진재': '입상고정틀+내화충진재',
        '에어컨 냉매배관': '냉매배관', '에어컨 냉매박스': '냉매배관', '테스트용질소': '냉매배관',
        '제습기': '마감자재', '방열기': '마감자재', '온수기': '마감자재', '터파기': '마감자재', '되메우기': '마감자재', '모래부설': '마감자재',
        'IDNTIFICATION&TAGGING': '명판', '배관인식표': '명판',
        '게이트 밸브': '밸브류', '목긴볼밸브': '밸브류', '버터플라이밸브': '밸브류', '체크밸브': '밸브류', '볼밸브': '밸브류', '청소용수채': '밸브류',
        '관보온': '보온재', '밸브보온': '보온재', '아티론보온': '보온재', '폼보온': '보온재',
        '잡재료비': '소모잡자재', '유성페인트': '소모잡자재', '잡철물제작설치': '소모잡자재',
        '디지털수도미터': '수도계량기', '디지털온수미터': '수도계량기',
        '방수스리브': '스리브', '강관스리브': '스리브', 'F.D': '스리브', '벽체점검용스리브': '스리브', '삼중루프드레인': '스리브',
        '동파방지전열선': '열선', '초절전온수관': '열선', '점검구박스': '열선', '온도조절기': '열선',
        '펌프가대설치': '조립식가대', '기계실작업발판': '조립식가대', '시스템찬넬': '조립식가대',
        '3구 분기관': '통합거치대', '수압용압력계': '통합거치대', '수도계량기 보호함': '통합거치대'
      };

      const results: any[] = [];
      const aiItems: any[] = [];

      items.forEach(item => {
        let category = '';
        const name = item.name.replace(/\s+/g, '');

        // 0. Price Rule (Sync with utils/classifier.ts)
        // If both material and labor unit prices are 0, classify as "지금자재"
        if (item.materialUnitPrice === 0 && item.laborUnitPrice === 0) {
          category = '지금자재';
        } else {
          // Check custom rules first!
          let customMatched = false;
          if (customRules && Array.isArray(customRules)) {
            const sortedRules = [...customRules].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
            for (const rule of sortedRules) {
              if (!rule.isEnabled) continue;
              const cleanPattern = rule.pattern.replace(/\s+/g, '').toLowerCase();
              const cleanName = item.name.replace(/\s+/g, '').toLowerCase();
              const cleanSpec = (item.specification || '').replace(/\s+/g, '').toLowerCase();
              
              if (cleanName.includes(cleanPattern) || cleanSpec.includes(cleanPattern)) {
                category = rule.category;
                customMatched = true;
                break;
              }
            }
          }

          if (!customMatched) {
            // 1. Local Rule Match
            for (const [key, cat] of Object.entries(MAPPING_RULES)) {
              const cleanKey = key.replace(/\s+/g, '');
              if (name.includes(cleanKey) || cleanKey.includes(name)) {
                category = cat;
                break;
              }
            }
          }

          // 2. Section Rule (Heating)
          if (item.section?.includes('난방') || item.name.includes('난방')) {
            if (category.startsWith('STS위생') || name.includes('스텐') || name.includes('STS')) {
               category = (item.name.includes('관') || item.name.includes('파이프')) ? 'STS난방관' : 'STS난방부속';
            } else if (item.name.includes('분배기') || item.name.includes('온도조절') || item.name.includes('구동기') || item.name.includes('D15EA')) {
               category = '난방분배기';
            } else if (((item.name.includes('폴리부틸렌') || item.name.includes('PB')) && (item.name.includes('난방') || item.name.includes('코일'))) || (item.name.includes('난방') && item.name.includes('용'))) {
               category = '난방코일';
            }
          }

          // Final overrides
          if (item.section?.includes('01010401') || item.section?.includes('01010801') || item.section?.includes('010104010')) {
            const spec = item.specification || '';
            const normName = name.replace(/\s+/g, '').toLowerCase();
            const normSpec = spec.replace(/\s+/g, '').toLowerCase();

            const hasPB = normName.includes('폴리부틸렌') || normName.includes('폴리푸틸렌') || normName.includes('pb') ||
                          normSpec.includes('폴리부틸렌') || normSpec.includes('폴리푸틸렌') || normSpec.includes('pb');
                          
            if (hasPB) {
              const hasD20 = normName.includes('20') || normSpec.includes('20') || normSpec.includes('d20');
              const hasD15 = normName.includes('15') || normSpec.includes('15') || normSpec.includes('d15');
              
              if (hasD20) {
                category = 'PB';
              } else if (hasD15) {
                const isHeating = normName.includes('난방') || normSpec.includes('난방');
                const isSanitary = normName.includes('위생') || normSpec.includes('위생') || normName.includes('급수') || normSpec.includes('급수') || normName.includes('급탕') || normSpec.includes('급탕');
                
                if (isHeating) {
                  category = '난방코일';
                } else if (isSanitary) {
                  category = 'PB';
                } else {
                  if (item.section?.includes('난방')) {
                    category = '난방코일';
                  } else {
                    category = 'PB';
                  }
                }
              }
            }
          }

          // User rule for 01010403 starting sections
          if (item.section?.includes('01010403')) {
            const spec = item.specification || '';
            const normName = name.replace(/\s+/g, '').toLowerCase();
            const normSpec = spec.replace(/\s+/g, '').toLowerCase();

            const hasPB = normName.includes('폴리부틸렌') || normName.includes('폴리푸틸렌') || normName.includes('pb') ||
                          normSpec.includes('폴리부틸렌') || normSpec.includes('폴리푸틸렌') || normSpec.includes('pb');
                          
            if (hasPB) {
              const normSpecNoSec = normSpec.replace(/\s+/g, '');
              const isIntegratedStand = (normSpecNoSec.includes('pb수전엘보') && (normSpecNoSec.includes('15') || normSpecNoSec.includes('d15'))) ||
                                       (normSpecNoSec.includes('pb티이') && (normSpecNoSec.includes('15') || normSpecNoSec.includes('d15')));

              if (isIntegratedStand) {
                category = '통합거치대';
              } else {
                const hasD15 = normName.includes('15') || normSpec.includes('15') || normSpec.includes('d15');
                const isSanitary = normName.includes('위생') || normSpec.includes('위생') || 
                                   normName.includes('급수') || normSpec.includes('급수') || 
                                   normName.includes('급탕') || normSpec.includes('급탕');
                                   
                if (hasD15 || isSanitary) {
                  category = 'PB';
                }
              }
            }
          }

          // User rule for 01010406 starting sections
          if (item.section?.includes('01010406')) {
            const spec = item.specification || '';
            const normName = name.replace(/\s+/g, '');
            const normSpec = spec.replace(/\s+/g, '');

            if (normName.includes('아티론보온') || normSpec.includes('아티론보온')) {
              category = '외주';
            }
          }

          // User rule for 01010804 starting sections
          if (item.section?.includes('01010804')) {
            const spec = item.specification || '';
            const normName = name.replace(/\s+/g, '');
            const normSpec = spec.replace(/\s+/g, '');

            if (normName.includes('관보온') || normSpec.includes('관보온')) {
              category = '외주';
            }
          }

          // User rule for 01010604 starting sections
          if (item.section?.includes('01010604')) {
            const spec = item.specification || '';
            const normName = name.replace(/\s+/g, '').toLowerCase();
            const normSpec = spec.replace(/\s+/g, '').toLowerCase();

            if (
              normName.includes('f.d(stl)') || 
              normName.includes('fd(stl)') || 
              (normName.includes('f.d') && normName.includes('stl')) ||
              (normName.includes('fd') && normName.includes('stl')) ||
              normName === 'f.d' ||
              normName === 'fd' ||
              normSpec.includes('f.d(stl)') ||
              normSpec.includes('fd(stl)')
            ) {
              category = '외주';
            }
          }

          if (name.includes('일반배관용STS강관이음쇠')) {
            if (item.section?.includes('01010403')) {
              category = '통합거치대';
            }
          }
          if (name.includes('온도조절밸브비례제어형') || name.includes('구동기비례제어형')) {
            category = '난방분배기';
          }
          if (name.includes('펌프가대설치')) {
            category = '조립식가대';
          }
          if (name.includes('강관스리브')) {
            category = '스리브';
          }

          // Rule for 가설공사
          const section = item.section || '';
          const spec = item.specification || '';
          const normNameForTemp = name.replace(/\s+/g, '');
          const normSpecForTemp = spec.replace(/\s+/g, '');

          const has0101InDigits = section ? section.split(/[^0-9]/).some((part: string) => part.startsWith('0101')) : true;

          const isTemporaryWorkName = normNameForTemp.includes('옥내공사용수배관설치비') ||
                                      normNameForTemp.includes('가설소화호스함') ||
                                      normNameForTemp.includes('지수층배관설치비') ||
                                      normNameForTemp.includes('주차장우수유도배관설치비') ||
                                      normNameForTemp.includes('지하환기덕트공사비') ||
                                      normSpecForTemp.includes('옥내공사용수배관설치비') ||
                                      normSpecForTemp.includes('가설소화호스함') ||
                                      normSpecForTemp.includes('지수층배관설치비') ||
                                      normSpecForTemp.includes('주차장우수유도배관설치비') ||
                                      normSpecForTemp.includes('지하환기덕트공사비');

          if ((section && !has0101InDigits) || isTemporaryWorkName) {
            category = '가설공사';
          }
        }

        if (category && categories.includes(category)) {
          results.push({ id: item.id, category });
        } else {
          aiItems.push(item);
        }
      });

      // If everything classified locally, return early
      if (aiItems.length === 0) {
        return res.json(results);
      }

      // 3. AI Hybrid Classification for remaining items
      const prompt = `Classify construction items: ${categories.join(', ')}
Guidelines:
- Best category from list.
- Return JSON array: [{"id": "...", "category": "..."}]
Data: ${JSON.stringify(aiItems.map(i => ({ id: i.id, n: i.name, s: i.specification })))}`;

      // Helper for exponential backoff retry
      const callAIWithRetry = async (retries = 3, initialDelay = 3000) => {
        let delay = initialDelay;
        for (let i = 0; i < retries; i++) {
          try {
            // Use supported Gemini models according to current standards
            let modelName = 'gemini-3.7-flash';
            if (i === 1) modelName = 'gemini-3.1-flash-lite';
            if (i >= 2) modelName = 'gemini-flash-latest';
            
            return await ai.models.generateContent({
              model: modelName,
              contents: [{ parts: [{ text: prompt }] }],
              config: {
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      category: { type: Type.STRING }
                    },
                    required: ['id', 'category']
                  }
                }
              }
            });
          } catch (err: any) {
            const errorStr = JSON.stringify(err) + ' ' + (err.message || '');
            const isQuotaError = errorStr.includes('429') || errorStr.includes('RESOURCE_EXHAUSTED');
            const isTransientError = isQuotaError || errorStr.includes('503') || errorStr.includes('500');
            
            if (isTransientError && i < retries - 1) {
              const baseDelay = isQuotaError ? 8000 : delay;
              const jitter = Math.random() * 2000;
              const waitTime = baseDelay + jitter;
              console.log(`AI Error (${isQuotaError ? 'Quota' : 'Transient'}), retry ${i+1}/${retries} after ${Math.round(waitTime)}ms`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              delay = delay * 2; 
              continue;
            }
            throw err;
          }
        }
        return null;
      };

      let response = null;
      try {
        response = await callAIWithRetry();
      } catch (aiErr: any) {
        console.warn('AI classification failed, applying heuristic fallback:', aiErr?.message);
      }

      if (response && response.text) {
        try {
          const aiResults = JSON.parse(response.text);
          if (Array.isArray(aiResults)) {
            results.push(...aiResults);
          }
        } catch (parseErr) {
          console.error('AI JSON parse fail:', parseErr);
        }
      }

      // Ensure every item from original input has a classification result
      const classifiedIds = new Set(results.map(r => r.id));
      aiItems.forEach(item => {
        if (!classifiedIds.has(item.id)) {
          // Heuristic fallback: match by existing remark, name keywords, or default category
          let matchedCat = '';
          if (item.remark && categories.includes(item.remark)) {
            matchedCat = item.remark;
          } else {
            matchedCat = categories.includes('기타') ? '기타' : (categories[0] || '미분류');
          }
          results.push({ id: item.id, category: matchedCat });
        }
      });

      res.json(results);
    } catch (error: any) {
      console.error('Classification error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();

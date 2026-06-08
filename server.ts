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
      const { items, categories } = req.body;
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
        '배관용스테인리스강관': 'STS위생관', '일반배관용스테인리스강관': 'STS위생관',
        '일반배관용STS강관이음쇠': 'STS위생부속', '무용접스텐엘보': 'STS위생부속', '무용접스텐티이': 'STS위생부속', '무용접스텐리듀서': 'STS위생부속', '무용접스텐캡': 'STS위생부속', '무용접스텐플랜지아답타': 'STS위생부속',
        '일반행거': 'SUPPORT류', '절연행가': 'SUPPORT류', 'U자형볼트': 'SUPPORT류', '인서트플레이트': 'SUPPORT류', '달대볼트': 'SUPPORT류',
        '감압밸브': '감압변', '세대별물감압밸브': '감압변',
        '용접식관이음쇠': '강관부속', '무용접엘보': '강관부속', '무용접티이': '강관부속', '무용접플랜지아답타니플': '강관부속', '무용접고정식커플링': '강관부속', '강관용접': '강관부속', '용접합후렌지': '강관부속',
        '일체형 고정 틀': '고정 틀',
        '온수분배기': '난방분배기', '온도조절밸브': '난방분배기', '구동기': '난방분배기', '씽크수전지지대': '난방분배기', '유니온엘보': '난방분배기',
        '코일고정U핀': '난방코일', 'FLOORPANEL': '난방코일',
        '내화충진재': '내화충진재',
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
          // 1. Local Rule Match
          for (const [key, cat] of Object.entries(MAPPING_RULES)) {
            const cleanKey = key.replace(/\s+/g, '');
            if (name.includes(cleanKey) || cleanKey.includes(name)) {
              category = cat;
              break;
            }
          }

          // 2. Section Rule (Heating)
          if (item.section?.includes('난방') || item.name.includes('난방')) {
            if (category.startsWith('STS위생') || name.includes('스텐') || name.includes('STS')) {
               category = (item.name.includes('관') || item.name.includes('파이프')) ? 'STS 난방관' : 'STS 난방부속';
            } else if (item.name.includes('분배기') || item.name.includes('온도조절') || item.name.includes('구동기') || item.name.includes('D15EA')) {
               category = '난방분배기';
            } else if (((item.name.includes('폴리부틸렌') || item.name.includes('PB')) && (item.name.includes('난방') || item.name.includes('코일'))) || (item.name.includes('난방') && item.name.includes('용'))) {
               category = '난방코일';
            }
          }

          // Final overrides
          if (name.includes('온도조절밸브비례제어형') || name.includes('구동기비례제어형')) {
            category = '난방분배기';
          }
          if (name.includes('강관스리브')) {
            category = '스리브';
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
      const prompt = `
        다음 건설 내역 항목들을 분석하여 카테고리로 분류해주세요.
        
        사용 가능한 카테고리: ${categories.join(', ')}
        
        분류 지침:
        - 항목 이름과 규격을 보고 가장 적절한 카테고리를 선택하세요.
        - 난방 공사(section에 '난방' 포함)인 경우 STS 관/부속은 'STS 난방관' 또는 'STS 난방부속'으로 분류하세요.
        - 목록에 없는 카테고리는 사용하지 마세요.
        
        데이터: ${JSON.stringify(aiItems)}
      `;

      // Helper for exponential backoff retry
      const callAIWithRetry = async (retries = 3, delay = 2000) => {
        for (let i = 0; i < retries; i++) {
          try {
            return await ai.models.generateContent({
              model: 'gemini-3.5-flash',
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
            if (err.message?.includes('429') && i < retries - 1) {
              console.log(`429 Error, retry ${i+1}/${retries} after ${delay}ms`);
              await new Promise(resolve => setTimeout(resolve, delay));
              delay *= 2;
              continue;
            }
            throw err;
          }
        }
      };

      const response = await callAIWithRetry().catch(err => {
        console.error('AI fully failed after retries:', err);
        return null;
      });

      if (response && response.text) {
        try {
          const aiResults = JSON.parse(response.text);
          results.push(...aiResults);
        } catch (parseErr) {
          console.error('AI JSON parse fail:', parseErr);
        }
      }

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

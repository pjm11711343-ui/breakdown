export interface SpecItem {
  id: string;
  name: string;        // 품명
  specification: string; // 규격
  unit: string;        // 단위
  quantity: number;    // 수량
  materialUnitPrice: number; // 재료비 단가
  materialAmount: number;    // 재료비 금액
  laborUnitPrice: number;    // 노무비 단가
  laborAmount: number;       // 노무비 금액
  unitPrice: number;   // 합계 단가 (자재+노무)
  amount: number;      // 금액 합계
  category: string;    // 자재분류
  section: string;     // 공정내용 (Excel Header)
  remark: string;      // 비고
  originalCategory?: string; // Original classification before AI/manual changes
  excelRowIdx?: number; // Original Excel row index
  memo?: string;       // 메모
  executionAmount?: number; // 수기 실행금액
  recommendationSource?: 'ai' | 'history' | 'rule' | 'manual'; // 분류 근거
}

export interface Project {
  id: string;
  name: string;
  items: SpecItem[];
  theme: ThemeType;
  config?: AppConfig;
  categories: string[];
  categoryColors?: Record<string, string>; // Category name -> hex color
  updatedAt: number;
  status?: 'working' | 'completed';
  categoryEstimates?: Record<string, number>; // Manual input quantity/amount per category
  // New project metadata fields
  commencementDate?: string; // 착공일
  completionDate?: string;   // 준공일
  buildingCount?: string;    // 동수
  householdCount?: string;   // 세대수
  highestFloor?: string;     // 최상층
  lowestFloor?: string;      // 최하층
}

export type ThemeType = 'industrial' | 'modern' | 'minimal' | 'high-density';

export interface CustomClassificationRule {
  id: string;
  pattern: string;
  category: string;
  isEnabled: boolean;
  priority: number; // Higher number = higher priority
  description?: string;
}

export interface LearnedMapping {
  id: string;
  name: string;
  specification: string;
  category: string;
  hitCount: number;
  lastUpdatedAt: number;
}

export interface AppConfig {
  theme: ThemeType;
  fontFamily: string;
  fontSize: number;
}

export const INITIAL_CATEGORIES = [
  '백강관', '강관부속', 'STS위생관', 'STS위생부속', 'STS난방관', 'STS난방부속', 
  '고강도PVC', 'PVC', 'PB', '냉매배관', '난방코일', '난방분배기', 
  '밸브류', '수도계량기', '감압변', '스리브', '입상고정틀+내화충진재', 
  '조립식가대', 'SUPPORT류', '마감자재', '통합거치대', '보온재', '소모잡자재', 
  '공구손료', '안전장비류', '명판', '휀장비류', '기타자재', '지금자재', 
  '외주', '가설공사'
];

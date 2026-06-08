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
}

export interface Project {
  id: string;
  name: string;
  items: SpecItem[];
  theme: ThemeType;
  categories: string[];
  updatedAt: number;
}

export type ThemeType = 'industrial' | 'modern' | 'minimal' | 'high-density';

export interface AppConfig {
  theme: ThemeType;
}

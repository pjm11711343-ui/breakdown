import { SpecItem } from '../types';

/**
 * 외주비 관련 카테고리인지 판별합니다.
 * 예: '외주', '외주비', '외주비+', '외주비+덕트덕', '외주비+지역난방지', '외주비 열선열', '외주공사', '외주노무' 등
 */
export function isOutsourcingCategory(category?: string | null): boolean {
  if (!category) return false;
  const clean = category.trim().replace(/\s+/g, '');
  return clean.includes('외주비') || clean.includes('외주');
}

/**
 * 간접비 관련 카테고리인지 판별합니다.
 * 예: '간접비', '간접공사비', '간접노무비', '간접경비', '간접' 등
 */
export function isIndirectCostCategory(category?: string | null): boolean {
  if (!category) return false;
  const clean = category.trim().replace(/\s+/g, '');
  return clean.includes('간접비') || clean.includes('간접');
}

/**
 * 지급자재 관련 카테고리인지 판별합니다.
 * 예: '지급자재', '지금자재'(오타 대응), '관급자재', '발주자지급' 등
 */
export function isClientSuppliedCategory(category?: string | null): boolean {
  if (!category) return false;
  const clean = category.trim().replace(/\s+/g, '');
  return clean.includes('지급자재') || clean.includes('지금자재') || clean.includes('관급자재') || clean.includes('발주처지급');
}

/**
 * 품목이 외주 관련인지 판별합니다 (카테고리 또는 품명 기준).
 */
export function isOutsourcingItem(item: SpecItem): boolean {
  if (isOutsourcingCategory(item.category)) return true;
  const name = item.name || '';
  return name.includes('외주');
}

/**
 * 안전장비류 관련 카테고리인지 판별합니다.
 * 예: '안전장비류', '안전장비', '안전' 등
 */
export function isSafetyEquipmentCategory(category?: string | null): boolean {
  if (!category) return false;
  const clean = category.trim().replace(/\s+/g, '');
  return clean === '안전장비류' || clean === '안전' || clean.includes('안전장비');
}

/**
 * 품목이 안전장비류 관련인지 판별합니다 (카테고리 또는 품명 기준).
 */
export function isSafetyEquipmentItem(item: SpecItem): boolean {
  if (isSafetyEquipmentCategory(item.category)) return true;
  const name = item.name || '';
  return name.includes('안전장비');
}

/**
 * 자재비(재료비) 금액 집계에서 완전히 제외해야 하는 카테고리인지 판별합니다.
 * - 간접비 계열 카테고리
 * - 지급자재 계열 카테고리
 * - 안전장비류 계열 카테고리 (별도 분리 관리)
 * - 외주비 계열 카테고리 (방식 2: 외주비는 재료비를 포함하여 외주 턴키로 일괄 집계하므로 순수 재료비에서 제외)
 */
export function isExcludedFromMaterialCost(category?: string | null): boolean {
  return isIndirectCostCategory(category) || isClientSuppliedCategory(category) || isSafetyEquipmentCategory(category) || isOutsourcingCategory(category);
}

/**
 * 개별 품목의 순수 자재비(재료비) 금액을 산출합니다.
 * 간접비, 지급자재, 안전장비류, 외주비(방식 2) 카테고리/품목인 경우 자재비 금액은 0(제외)입니다.
 */
export function getItemMaterialCost(item: SpecItem): number {
  // 1. 간접비, 지급자재, 안전장비류, 외주 품목은 일반 재료비에서 전면 제외
  if (isExcludedFromMaterialCost(item.category) || isSafetyEquipmentItem(item) || isOutsourcingItem(item)) {
    return 0;
  }

  // 2. 명시된 재료비 금액이 있는 경우
  if (item.materialAmount !== undefined && item.materialAmount !== null && item.materialAmount > 0) {
    return item.materialAmount;
  }

  // 3. 재료비 단가와 수량이 있는 경우
  if (item.materialUnitPrice && item.materialUnitPrice > 0 && item.quantity > 0) {
    return Math.round(item.materialUnitPrice * item.quantity);
  }

  // 4. 노무비만 있고 재료비가 분리되지 않은 경우 금액 차감
  if (item.laborAmount && item.laborAmount > 0) {
    return Math.max(0, (item.amount || 0) - item.laborAmount);
  }

  return item.amount || 0;
}

/**
 * 개별 품목의 외주비/노무비 금액을 산출합니다.
 */
export function getItemLaborCost(item: SpecItem): number {
  // 안전장비류는 일반 노무비에서 제외
  if (isSafetyEquipmentItem(item)) {
    return 0;
  }

  // 1. 외주비 항목 (카테고리 또는 품명): 방식 2 적용 - 재료비와 노무비를 일괄하여 외주비(턴키)로 집계
  if (isOutsourcingItem(item)) {
    return item.amount || ((item.materialAmount || 0) + (item.laborAmount || 0)) || ((item.quantity || 0) * (item.unitPrice || 0)) || 0;
  }

  // 2. 간접비 카테고리: 전체 금액이 간접노무비/경비/간접비로 인정
  if (isIndirectCostCategory(item.category)) {
    return item.amount || (item.materialAmount || 0) + (item.laborAmount || 0) || (item.quantity * item.unitPrice) || 0;
  }

  // 3. 지급자재: 시공/설치 노무비가 별도 기재된 경우에만 인정
  if (isClientSuppliedCategory(item.category)) {
    return item.laborAmount || 0;
  }

  // 4. 일반 품목의 노무비
  if (item.laborAmount !== undefined && item.laborAmount !== null && item.laborAmount > 0) {
    return item.laborAmount;
  }
  if (item.laborUnitPrice && item.laborUnitPrice > 0 && item.quantity > 0) {
    return Math.round(item.laborUnitPrice * item.quantity);
  }

  return 0;
}

/**
 * 개별 품목의 총 도급/실행 계약 인정 금액을 산출합니다.
 * 안전장비류는 총 계약 합계 금액(TOTAL)에서 제외 ([별도] 관리)
 */
export function getItemContractAmount(item: SpecItem): number {
  if (isSafetyEquipmentItem(item)) {
    return 0;
  }
  if (isClientSuppliedCategory(item.category)) {
    return getItemLaborCost(item); // 지급자재는 자재비 0원, 시공노무비만 인정
  }
  if (isIndirectCostCategory(item.category)) {
    return item.amount || getItemLaborCost(item);
  }
  if (isOutsourcingItem(item)) {
    return getItemLaborCost(item); // 방식 2: 외주비 전액 (재료비+노무비 일괄)
  }
  return item.amount || (getItemMaterialCost(item) + getItemLaborCost(item));
}

export interface CostBreakdown {
  materialCost: number;             // 순수 재료비 합계 (일반 품목 재료비, 외주 재료비 제외)
  laborCost: number;                // 일반 직접노무비
  outsourcingCost: number;          // 외주비 (재료비 + 노무비 일괄)
  indirectCost: number;             // 간접비
  clientSuppliedCost: number;       // 지급자재비
  safetyEquipmentCost: number;      // [별도] 안전장비류
  totalContractAmount: number;      // 총 계약 합계 금액 (안전장비류 제외)
  totalLaborAndOutsourcing: number; // 외주 및 시공/노무비 합계 (노무 + 외주 + 간접비)
}

/**
 * 프로젝트 전 품목의 종합 원가 구성(5대 원가요소 + 안전장비 별도)을 일관되게 산출합니다.
 * [방식 2]: 외주 품목의 재료비는 일반 재료비에서 제외하고, 외주비에 일괄 합산합니다.
 */
export function calculateCostBreakdown(items: SpecItem[]): CostBreakdown {
  let materialCost = 0;
  let laborCost = 0;
  let outsourcingCost = 0;
  let indirectCost = 0;
  let clientSuppliedCost = 0;
  let safetyEquipmentCost = 0;

  items.forEach(item => {
    const category = item.category || '';

    // 1. 안전장비류: 총 계약 합계 금액에서 전면 제외하고 별도 집계
    if (isSafetyEquipmentItem(item)) {
      safetyEquipmentCost += (item.amount || (item.materialAmount || 0) + (item.laborAmount || 0));
      return;
    }

    // 2. 지급자재: 발주자 지급이므로 자재비 0원, 시공노무비만 인정
    if (isClientSuppliedCategory(category)) {
      clientSuppliedCost += (item.amount || getItemLaborCost(item));
      return;
    }

    // 3. 간접비: 전액 간접비로 집계
    if (isIndirectCostCategory(category)) {
      indirectCost += (item.amount || getItemLaborCost(item));
      return;
    }

    // 4. 외주비 (방식 2): 외주 재료비와 노무비를 일괄하여 외주비로 집계 (일반 재료비에서 제외)
    if (isOutsourcingItem(item)) {
      const fullOutsourcingAmount = item.amount || ((item.materialAmount || 0) + (item.laborAmount || 0)) || ((item.quantity || 0) * (item.unitPrice || 0));
      outsourcingCost += fullOutsourcingAmount;
      return;
    }

    // 5. 일반 품목의 재료비 및 노무비
    materialCost += getItemMaterialCost(item);
    laborCost += getItemLaborCost(item);
  });

  const totalContractAmount = materialCost + laborCost + outsourcingCost + indirectCost + clientSuppliedCost;
  const totalLaborAndOutsourcing = laborCost + outsourcingCost + indirectCost;

  return {
    materialCost,
    laborCost,
    outsourcingCost,
    indirectCost,
    clientSuppliedCost,
    safetyEquipmentCost,
    totalContractAmount,
    totalLaborAndOutsourcing
  };
}

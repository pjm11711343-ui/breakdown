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
 * 자재비(재료비) 금액 집계에서 완전히 제외해야 하는 카테고리인지 판별합니다.
 * - 간접비 계열 카테고리
 * - 지급자재 계열 카테고리
 * * 외주비는 이제 분리 가능하므로 제외 대상에서 뺍니다.
 */
export function isExcludedFromMaterialCost(category?: string | null): boolean {
  return isIndirectCostCategory(category) || isClientSuppliedCategory(category);
}

/**
 * 개별 품목의 순수 자재비(재료비) 금액을 산출합니다.
 * 간접비, 지급자재 카테고리인 경우 자재비 금액은 0(제외)입니다.
 */
export function getItemMaterialCost(item: SpecItem): number {
  // 1. 간접비, 지급자재는 자재비에서 전면 제외
  if (isExcludedFromMaterialCost(item.category)) {
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

  // 외주비 항목인데 재료비가 명시되지 않은 경우는 0으로 반환 (전액 노무비로 처리되기 위함)
  if (isOutsourcingItem(item)) {
    return 0;
  }

  return item.amount || 0;
}

/**
 * 개별 품목의 외주비/노무비 금액을 산출합니다.
 */
export function getItemLaborCost(item: SpecItem): number {
  // 1. 외주비 항목 (카테고리 또는 품명)
  if (isOutsourcingItem(item)) {
    // 명시된 노무비가 있으면 그것을 사용
    if (item.laborAmount !== undefined && item.laborAmount !== null && item.laborAmount > 0) {
      return item.laborAmount;
    }
    // 노무 단가가 있으면 계산
    if (item.laborUnitPrice && item.laborUnitPrice > 0 && item.quantity > 0) {
      return Math.round(item.laborUnitPrice * item.quantity);
    }
    // 명시된 재료비가 있다면 전체에서 재료비 뺀 값을 노무비로
    const matCost = getItemMaterialCost(item);
    if (matCost > 0) {
      return Math.max(0, (item.amount || 0) - matCost);
    }
    // 아무것도 명시 안 됐으면 전체를 노무비(외주비)로
    return item.amount || (item.quantity * item.unitPrice) || 0;
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
 */
export function getItemContractAmount(item: SpecItem): number {
  if (isOutsourcingItem(item)) {
    return getItemLaborCost(item);
  }
  if (isClientSuppliedCategory(item.category)) {
    return getItemLaborCost(item); // 지급자재는 자재비 0원
  }
  if (isIndirectCostCategory(item.category)) {
    return item.amount || getItemLaborCost(item);
  }
  return item.amount || (getItemMaterialCost(item) + getItemLaborCost(item));
}

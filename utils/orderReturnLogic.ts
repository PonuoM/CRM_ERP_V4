export type ReturnLogicResult = 
  | { type: 'NONE' }
  | { type: 'PROMPT_NEW_STATUS' }
  | { type: 'PROMPT_CONFIRM_RETURN' };

export const checkReturnStatusChange = (
  currentOrderStatus: string,
  currentBoxes: Array<{ returnStatus?: string | null }>
): ReturnLogicResult => {
  if (!currentBoxes || currentBoxes.length === 0) {
    return { type: 'NONE' };
  }

  const hasEmptyBox = currentBoxes.some(b => !b.returnStatus || b.returnStatus === '');
  const allBoxesHaveReturnStatus = currentBoxes.every(b => b.returnStatus && b.returnStatus !== '');

  // If order is Returned, but there is an empty box ("รอตรวจสอบ / ไม่ระบุ"), it can't be Returned anymore.
  if (currentOrderStatus === 'Returned' && hasEmptyBox) {
    return { type: 'PROMPT_NEW_STATUS' };
  }

  // If order is NOT Returned, but ALL boxes have a return status, it should become Returned.
  if (currentOrderStatus !== 'Returned' && allBoxesHaveReturnStatus) {
    return { type: 'PROMPT_CONFIRM_RETURN' };
  }

  return { type: 'NONE' };
};

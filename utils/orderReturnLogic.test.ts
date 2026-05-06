import { describe, it, expect } from 'vitest';
import { checkReturnStatusChange } from './orderReturnLogic';

describe('checkReturnStatusChange', () => {
  it('should return PROMPT_NEW_STATUS when order is Returned and one box is changed to null', () => {
    const currentBoxes = [{ returnStatus: 'returned' }, { returnStatus: null }];
    
    const result = checkReturnStatusChange('Returned', currentBoxes);
    expect(result.type).toBe('PROMPT_NEW_STATUS');
  });

  it('should return PROMPT_NEW_STATUS when order is Returned and all boxes are changed to null', () => {
    const currentBoxes = [{ returnStatus: null }];
    
    const result = checkReturnStatusChange('Returned', currentBoxes);
    expect(result.type).toBe('PROMPT_NEW_STATUS');
  });

  it('should return PROMPT_CONFIRM_RETURN when order is Pending and all boxes get a return status', () => {
    const currentBoxes = [{ returnStatus: 'returned' }, { returnStatus: 'damaged' }];
    
    const result = checkReturnStatusChange('Pending', currentBoxes);
    expect(result.type).toBe('PROMPT_CONFIRM_RETURN');
  });

  it('should return NONE when order is Pending and some boxes are still null', () => {
    const currentBoxes = [{ returnStatus: 'returned' }, { returnStatus: null }];
    
    const result = checkReturnStatusChange('Pending', currentBoxes);
    expect(result.type).toBe('NONE');
  });

  it('should return NONE if order is Returned and all boxes still have return status', () => {
    const currentBoxes = [{ returnStatus: 'returned' }];
    
    const result = checkReturnStatusChange('Returned', currentBoxes);
    expect(result.type).toBe('NONE');
  });
});

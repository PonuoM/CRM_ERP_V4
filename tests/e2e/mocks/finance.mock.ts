export const MOCK_ORDERS = [
  // TC1.1: Exact Match (Auto Match)
  {
    id: 'ORD-001',
    customer_id: 'CUST-001',
    total_amount: 1000,
    amount_paid: 1000, // or slip_total
    slip_total: 1000,
    reconciled_amount: 0,
    payment_status: 'PreApproved',
    payment_method: 'Transfer',
    transfer_date: '2023-10-27T10:00:00',
    slip_transfer_date: '2023-10-27T10:00:00',
    bank_account_id: 1,
    slip_bank_account_id: 1,
    customer_name: 'สมชาย 88',
    slips: [
      { amount: 1000, transfer_date: '2023-10-27T10:00:00', bank_account_id: 1 }
    ]
  },
  // TC1.2: Candidates Selection (Amount diff or Time diff)
  {
    id: 'ORD-002',
    customer_id: 'CUST-002',
    total_amount: 1500,
    amount_paid: 1500,
    slip_total: 1500,
    reconciled_amount: 0,
    payment_status: 'PreApproved',
    payment_method: 'Transfer',
    transfer_date: '2023-10-27T11:00:00',
    slip_transfer_date: '2023-10-27T11:00:00',
    bank_account_id: 1,
    slip_bank_account_id: 1,
    customer_name: 'สมหญิง 99',
    slips: [
      { amount: 1500, transfer_date: '2023-10-27T11:00:00', bank_account_id: 1 }
    ]
  }
];

export const MOCK_STATEMENTS = [
  // For ORD-001 (Exact Match: same amount, same time)
  {
    id: 101,
    transfer_at: '2023-10-27T10:00:00',
    amount: 1000,
    bank_account_id: 1,
    bank_display_name: 'KBank - 1234',
    channel: 'Mobile',
    description: 'Transfer 101'
  },
  // For ORD-002 (Candidate: slight time/amount diff)
  {
    id: 102,
    transfer_at: '2023-10-27T11:05:00', // 5 mins later
    amount: 1500, // same amount, close time
    bank_account_id: 1,
    bank_display_name: 'KBank - 1234',
    channel: 'Mobile',
    description: 'Transfer 102'
  },
  // For TC1.3 (Duplicate Match simulation)
  {
    id: 103,
    transfer_at: '2023-10-27T12:00:00',
    amount: 2000,
    bank_account_id: 1,
    bank_display_name: 'KBank - 1234',
    channel: 'Mobile',
    description: 'Transfer 103'
  }
];

export const MOCK_COD_DOCUMENTS = [
  // TC2.2 & 2.3: Shortage Reason
  {
    id: 201,
    document_number: 'COD-DOC-001',
    document_datetime: '2023-10-28T10:00:00',
    bank_account_id: 1,
    bank: 'KBank',
    total_input_amount: 1980, // Suppose 20 fee deducted
    total_order_amount: 2000,
    status: 'pending',
    items: [
      { id: 1, document_id: 201, tracking_number: 'TH001', order_id: 'ORD-COD-1', cod_amount: 2000, order_amount: 2000, status: 'pending' }
    ]
  },
  // TC2.4: Exact Match COD
  {
    id: 202,
    document_number: 'COD-DOC-002',
    document_datetime: '2023-10-28T14:00:00',
    bank_account_id: 1,
    bank: 'KBank',
    total_input_amount: 1000,
    total_order_amount: 1000,
    status: 'pending',
    items: [
      { id: 2, document_id: 202, tracking_number: 'TH002', order_id: 'ORD-COD-2', cod_amount: 1000, order_amount: 1000, status: 'pending' }
    ]
  }
];

export const MOCK_COD_STATEMENTS = [
  // For COD-DOC-001 (Shortage)
  {
    id: 301,
    transfer_at: '2023-10-28T10:05:00',
    amount: 1950, // 1950 != 1980, so amountDiff will be 30 and shortage reason will show
    bank_account_id: 1,
    bank_display_name: 'KBank - 1234'
  },
  // For COD-DOC-002 (Exact)
  {
    id: 302,
    transfer_at: '2023-10-28T14:05:00',
    amount: 1000, // matches total_input_amount exactly
    bank_account_id: 1,
    bank_display_name: 'KBank - 1234'
  }
];

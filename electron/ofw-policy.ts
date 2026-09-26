export function readRequest(action: unknown, input: unknown = {}) {
  const a = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const text = (key: string, max = 300) => {
    if (a[key] === undefined || a[key] === '') return undefined;
    if (typeof a[key] !== 'string' || a[key].length > max) throw new Error(`Invalid ${key}`);
    return a[key] as string;
  };
  const integer = (key: string, fallback: number) => {
    const n = a[key] ?? fallback;
    if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < fallback || n > 100000) throw new Error(`Invalid ${key}`);
    return n;
  };
  const date = (key: string) => {
    const d = text(key, 10);
    if (d && (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !Number.isFinite(Date.parse(d)) || new Date(d).toISOString().slice(0,10) !== d)) throw new Error(`Invalid ${key}`);
    return d;
  };
  switch (action) {
    case 'connect': return {name:'ofw_get_profile', arguments:{}};
    case 'sync': return {name:'ofw_sync_messages', arguments:{folders:['inbox','sent'],fetchUnreadBodies:false,deep:false}};
    case 'messages': {
      const folderId = text('folderId') ?? 'both';
      if (!['both','inbox','sent'].includes(folderId)) throw new Error('Invalid folder');
      const since=date('since'), until=date('until');
      if(since && until && since >= until) throw new Error('End date must be after start date');
      const size = integer('size', 1);
      if (size > 25) throw new Error('Message page size cannot exceed 25');
      return {name:'ofw_list_messages', arguments:{folderId,page:integer('page',1),size,q:text('q'),since,until,view:'compact',autoRefresh:true}};
    }
    case 'message': {
      const messageId=text('messageId',30);
      if(!messageId || !/^\d+$/.test(messageId)) throw new Error('Invalid message ID');
      return {name:'ofw_get_message', arguments:{messageId,allowMarkRead:false,view:'compact'}};
    }
    case 'expenses': return {name:'ofw_list_expenses', arguments:{start:integer('start',0),max:25}};
    case 'totals': return {name:'ofw_get_expense_totals', arguments:{}};
    case 'calendar': {
      const startDate=date('startDate'), endDate=date('endDate');
      if (!startDate || !endDate || startDate > endDate) throw new Error('Choose a valid calendar date range');
      return {name:'ofw_list_events', arguments:{startDate,endDate,detailed:true}};
    }
    default: throw new Error('This OFW operation is not available');
  }
}

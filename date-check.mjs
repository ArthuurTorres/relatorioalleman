import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const lines = readFileSync('./.env', 'utf8').split('\n').filter(l => l.includes('=')).reduce((acc, l) => { const [k,...v] = l.split('='); acc[k] = v.join('='); return acc; }, {});
const K = lines.SUPABASE_SERVICE_ROLE_KEY;
const U = lines.SUPABASE_URL;
const supabase = createClient(U, K);

const { data: max } = await supabase.from('utm_conversions').select('data_criacao').order('data_criacao', { ascending: false }).limit(1);
const { data: min } = await supabase.from('utm_conversions').select('data_criacao').order('data_criacao', { ascending: true }).limit(1);
const { count } = await supabase.from('utm_conversions').select('data_criacao', { count: 'exact', head: true });
const { data: maxLead } = await supabase.from('meta_leads').select('created_at').order('created_at', { ascending: false }).limit(1);
const { data: lastSync } = await supabase.from('meta_sync_state').select('finished_at').order('finished_at', { ascending: false }).limit(1);

console.log('Total deals:', count);
console.log('Mais recente utm_conversions:', max?.[0]?.data_criacao);
console.log('Mais antigo utm_conversions:', min?.[0]?.data_criacao);
console.log('Mais recente meta_leads:', maxLead?.[0]?.created_at);
console.log('Último sync finished:', lastSync?.[0]?.finished_at);

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Plus, Trash2, X, Settings, Home, PieChart, List, Calendar, FileText, Filter, BookOpen, Lock } from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default function App() {
  // === TRẠNG THÁI BẢO MẬT ===
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  
  // 👉 THAY ĐỔI MẬT KHẨU CỦA BẠN Ở ĐÂY
  const STATIC_PASSWORD = 'admin'; 

  // Các trạng thái dữ liệu (Data States)
  const [projects, setProjects] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([
    { id: '1', name: 'Đi chợ / Ăn uống', type: 'expense' },
    { id: '2', name: 'Điện nước / Internet', type: 'expense' },
    { id: '3', name: 'Mua sắm', type: 'expense' },
    { id: '4', name: 'Lương', type: 'income' },
    { id: '5', name: 'Kinh doanh', type: 'income' }
  ]);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [showTxModal, setShowTxModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');
  const [chartGroup, setChartGroup] = useState('month');

  // Kiểm tra trạng thái đăng nhập khi mở web
  useEffect(() => {
    const authStatus = sessionStorage.getItem('stc_auth_unlocked');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (passwordInput === STATIC_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem('stc_auth_unlocked', 'true');
    } else {
      alert('Mật khẩu không chính xác!');
      setPasswordInput('');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('stc_auth_unlocked');
  };

  // Fetch dữ liệu sau khi đã mở khóa
  useEffect(() => {
    if (isAuthenticated) fetchData();
  }, [isAuthenticated]);

  const fetchData = async () => {
    if (supabase) {
      try {
        const { data: pData } = await supabase.from('projects').select('*');
        const { data: tData } = await supabase.from('transactions').select('*');
        const { data: tmplData } = await supabase.from('templates').select('*');
        const { data: catData } = await supabase.from('custom_categories').select('*');
        if (pData) setProjects(pData);
        if (tData) setTransactions(tData);
        if (tmplData) setTemplates(tmplData);
        if (catData && catData.length > 0) setCategories(catData);
      } catch (error) {
        loadLocal();
      }
    } else {
      loadLocal();
    }
  };

  const loadLocal = () => {
    setProjects(JSON.parse(localStorage.getItem('stc_projects') || '[]'));
    setTransactions(JSON.parse(localStorage.getItem('stc_transactions') || '[]'));
    setTemplates(JSON.parse(localStorage.getItem('stc_templates') || '[]'));
    const localCat = JSON.parse(localStorage.getItem('stc_categories'));
    if (localCat) setCategories(localCat);
  };

  useEffect(() => {
    if (!supabase && isAuthenticated) {
      localStorage.setItem('stc_projects', JSON.stringify(projects));
      localStorage.setItem('stc_transactions', JSON.stringify(transactions));
      localStorage.setItem('stc_templates', JSON.stringify(templates));
      localStorage.setItem('stc_categories', JSON.stringify(categories));
    }
  }, [projects, transactions, templates, categories, isAuthenticated]);

  const formatCurrency = (val) => {
    if (!val) return '';
    const num = parseInt(val.toString().replace(/,/g, ''));
    return isNaN(num) ? '' : num.toLocaleString('en-US');
  };

  const getNumber = (val) => parseInt(val?.toString().replace(/,/g, '')) || 0;
  const generateId = () => Math.random().toString(36).substr(2, 9);

  const filteredTransactions = useMemo(() => {
    let filtered = transactions.filter(t => t.project_id === selectedProjectId);
    const today = new Date();
    if (dateFilter === 'today') {
      filtered = filtered.filter(t => t.date === today.toISOString().split('T')[0]);
    } else if (dateFilter === 'month') {
      filtered = filtered.filter(t => t.date.startsWith(today.toISOString().slice(0, 7)));
    } else if (dateFilter === 'year') {
      filtered = filtered.filter(t => t.date.startsWith(today.toISOString().slice(0, 4)));
    }
    return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, selectedProjectId, dateFilter]);

  const summary = useMemo(() => filteredTransactions.reduce((acc, curr) => {
    curr.type === 'income' ? acc.income += curr.amount : acc.expense += curr.amount;
    return acc;
  }, { income: 0, expense: 0 }), [filteredTransactions]);

  const chartData = useMemo(() => {
    const grouped = {};
    filteredTransactions.forEach(t => {
      let key = t.date;
      if (chartGroup === 'month') key = t.date.slice(0, 7);
      if (chartGroup === 'year') key = t.date.slice(0, 4);
      if (!grouped[key]) grouped[key] = { name: key, income: 0, expense: 0 };
      grouped[key][t.type] += t.amount;
    });
    return Object.values(grouped).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredTransactions, chartGroup]);

  const handleAddProject = async (name) => {
    const newP = { id: generateId(), name, created_at: new Date().toISOString() };
    if (supabase) {
      await supabase.from('projects').insert([newP]);
      fetchData();
    } else setProjects([...projects, newP]);
    if (!selectedProjectId) setSelectedProjectId(newP.id);
  };

  const handleDeleteProject = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa Sổ này?')) {
      if (supabase) {
        await supabase.from('projects').delete().eq('id', id);
        fetchData();
      } else {
        setProjects(projects.filter(p => p.id !== id));
        setTransactions(transactions.filter(t => t.project_id !== id));
      }
      if (selectedProjectId === id) setSelectedProjectId(null);
    }
  };

  const handleAddCategory = async (name, type) => {
    const newC = { id: generateId(), name, type, created_at: new Date().toISOString() };
    if (supabase) {
      await supabase.from('custom_categories').insert([newC]);
      fetchData();
    } else setCategories([...categories, newC]);
  };

  const handleAddTemplate = async (tmpl) => {
    const newTmpl = { ...tmpl, id: generateId(), created_at: new Date().toISOString() };
    if (supabase) {
      await supabase.from('templates').insert([newTmpl]);
      fetchData();
    } else setTemplates([...templates, newTmpl]);
  };

  const handleDeleteTemplate = async (id) => {
    if (supabase) {
      await supabase.from('templates').delete().eq('id', id);
      fetchData();
    } else setTemplates(templates.filter(t => t.id !== id));
  };

  const exportToExcel = () => {
    if (filteredTransactions.length === 0) return alert('Không có dữ liệu giao dịch nào để xuất!');
    let csvContent = "\uFEFFNgày,Danh Mục,Ghi Chú,Loại,Số Tiền (VNĐ)\n";
    filteredTransactions.forEach(t => {
      const typeStr = t.type === 'income' ? 'Thu' : 'Chi';
      const safeDesc = (t.description || '').replace(/,/g, ' ');
      csvContent += `${t.date},"${t.category}","${safeDesc}",${typeStr},${t.amount}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `SoThuChi_${selectedProjectId || 'data'}_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  };

  const TransactionModal = () => {
    const [txType, setTxType] = useState('expense');
    const [amountStr, setAmountStr] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [category, setCategory] = useState(categories.filter(c => c.type === 'expense')[0]?.name || '');
    const [desc, setDesc] = useState('');

    const applyTemplate = (tmpl) => {
      setTxType(tmpl.type);
      setAmountStr(formatCurrency(tmpl.amount));
      setCategory(tmpl.category);
      setDesc(tmpl.description || '');
    };

    const handleSave = async () => {
      const amount = getNumber(amountStr);
      if (!amount || amount <= 0) return alert('Vui lòng nhập số tiền hợp lệ');
      const newTx = { id: generateId(), project_id: selectedProjectId, type: txType, amount, date, category, description: desc, created_at: new Date().toISOString() };
      if (supabase) {
        await supabase.from('transactions').insert([newTx]);
        fetchData();
      } else setTransactions([...transactions, newTx]);
      setShowTxModal(false);
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold">Ghi Thu / Chi Mới</h3>
            <button onClick={() => setShowTxModal(false)}><X className="text-gray-500 w-8 h-8" /></button>
          </div>
          {templates.length > 0 && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg flex flex-wrap gap-2">
              <p className="text-sm font-semibold w-full text-blue-800">Chọn nhanh từ mẫu:</p>
              {templates.map(t => <button key={t.id} onClick={() => applyTemplate(t)} className="px-3 py-1 bg-white border rounded-md text-blue-700">{t.name}</button>)}
            </div>
          )}
          <div className="flex gap-2 mb-6">
            <button className={`flex-1 py-3 font-bold rounded-lg ${txType === 'income' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`} onClick={() => { setTxType('income'); setCategory(categories.find(c => c.type === 'income')?.name || ''); }}>+ KHOẢN THU</button>
            <button className={`flex-1 py-3 font-bold rounded-lg ${txType === 'expense' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`} onClick={() => { setTxType('expense'); setCategory(categories.find(c => c.type === 'expense')?.name || ''); }}>- KHOẢN CHI</button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block font-bold mb-2">Số Tiền (VNĐ) *</label>
              <input type="text" value={amountStr} onChange={(e) => setAmountStr(formatCurrency(e.target.value))} className="w-full text-2xl p-3 border-2 rounded-lg" placeholder="1,000,000" />
            </div>
            <div className="flex gap-4">
              <div className="flex-1"><label className="block font-bold mb-2">Ngày</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-3 border-2 rounded-lg" /></div>
              <div className="flex-1">
                <label className="block font-bold mb-2">Danh Mục</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-3 border-2 rounded-lg">
                  {categories.filter(c => c.type === txType).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div><label className="block font-bold mb-2">Ghi Chú</label><input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} className="w-full p-3 border-2 rounded-lg" /></div>
          </div>
          <div className="mt-8 flex justify-end gap-4">
            <button onClick={()
import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Plus, Trash2, X, Settings, Home, PieChart, List, Calendar, FileText, Filter, BookOpen } from 'lucide-react';

// Khởi tạo Supabase an toàn (Fallback sang LocalStorage nếu chưa có Key)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default function App() {
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
  
  // Modals
  const [showTxModal, setShowTxModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  
  // Filters
  const [dateFilter, setDateFilter] = useState('all'); // all, today, month, year
  const [chartGroup, setChartGroup] = useState('month'); // day, month, year

  // Load Data
  useEffect(() => {
    fetchData();
  }, []);

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
        console.error("Supabase fetch error:", error);
        loadLocal();
      }
    } else {
      loadLocal();
    }
  };

  const loadLocal = () => {
    const localP = JSON.parse(localStorage.getItem('stc_projects') || '[]');
    const localT = JSON.parse(localStorage.getItem('stc_transactions') || '[]');
    const localTmpl = JSON.parse(localStorage.getItem('stc_templates') || '[]');
    const localCat = JSON.parse(localStorage.getItem('stc_categories'));
    
    setProjects(localP);
    setTransactions(localT);
    setTemplates(localTmpl);
    if (localCat) setCategories(localCat);
  };

  // Sync Local Data
  useEffect(() => {
    if (!supabase) {
      localStorage.setItem('stc_projects', JSON.stringify(projects));
      localStorage.setItem('stc_transactions', JSON.stringify(transactions));
      localStorage.setItem('stc_templates', JSON.stringify(templates));
      localStorage.setItem('stc_categories', JSON.stringify(categories));
    }
  }, [projects, transactions, templates, categories]);

  // Helpers
  const formatCurrency = (val) => {
    if (!val) return '';
    const num = parseInt(val.toString().replace(/,/g, ''));
    if (isNaN(num)) return '';
    return num.toLocaleString('en-US');
  };

  const getNumber = (val) => {
    if (!val) return 0;
    return parseInt(val.toString().replace(/,/g, '')) || 0;
  };

  const generateId = () => Math.random().toString(36).substr(2, 9);

  // Computed Data based on Filters
  const filteredTransactions = useMemo(() => {
    let filtered = transactions.filter(t => t.project_id === selectedProjectId);
    const today = new Date();
    
    if (dateFilter === 'today') {
      const todayStr = today.toISOString().split('T')[0];
      filtered = filtered.filter(t => t.date === todayStr);
    } else if (dateFilter === 'month') {
      const monthStr = today.toISOString().slice(0, 7);
      filtered = filtered.filter(t => t.date.startsWith(monthStr));
    } else if (dateFilter === 'year') {
      const yearStr = today.toISOString().slice(0, 4);
      filtered = filtered.filter(t => t.date.startsWith(yearStr));
    }
    
    return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, selectedProjectId, dateFilter]);

  const summary = useMemo(() => {
    return filteredTransactions.reduce((acc, curr) => {
      if (curr.type === 'income') acc.income += curr.amount;
      else acc.expense += curr.amount;
      return acc;
    }, { income: 0, expense: 0 });
  }, [filteredTransactions]);

  const chartData = useMemo(() => {
    const grouped = {};
    filteredTransactions.forEach(t => {
      let key = t.date; // default day
      if (chartGroup === 'month') key = t.date.slice(0, 7);
      if (chartGroup === 'year') key = t.date.slice(0, 4);
      
      if (!grouped[key]) grouped[key] = { name: key, income: 0, expense: 0 };
      grouped[key][t.type] += t.amount;
    });
    
    return Object.values(grouped).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredTransactions, chartGroup]);

  // Actions
  const handleAddProject = async (name) => {
    const newP = { id: generateId(), name, created_at: new Date().toISOString() };
    if (supabase) {
      await supabase.from('projects').insert([newP]);
      fetchData();
    } else {
      setProjects([...projects, newP]);
    }
    if (!selectedProjectId) setSelectedProjectId(newP.id);
  };

  const handleDeleteProject = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa Sổ này và toàn bộ giao dịch bên trong?')) {
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
    } else {
      setCategories([...categories, newC]);
    }
  };

  const handleAddTemplate = async (tmpl) => {
    const newTmpl = { ...tmpl, id: generateId(), created_at: new Date().toISOString() };
    if (supabase) {
      await supabase.from('templates').insert([newTmpl]);
      fetchData();
    } else {
      setTemplates([...templates, newTmpl]);
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (supabase) {
      await supabase.from('templates').delete().eq('id', id);
      fetchData();
    } else {
      setTemplates(templates.filter(t => t.id !== id));
    }
  };

  // Hàm xuất dữ liệu ra file CSV (Mở trực tiếp bằng Excel hoặc Google Sheets)
  const exportToExcel = () => {
    if (filteredTransactions.length === 0) {
      alert('Không có dữ liệu giao dịch nào để xuất!');
      return;
    }

    let csvContent = "\uFEFFNgày,Danh Mục,Ghi Chú,Loại,Số Tiền (VNĐ)\n";
    
    filteredTransactions.forEach(t => {
      const typeStr = t.type === 'income' ? 'Thu' : 'Chi';
      const safeDesc = (t.description || '').replace(/,/g, ' ');
      csvContent += `${t.date},"${t.category}","${safeDesc}",${typeStr},${t.amount}\n`; });  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.setAttribute('href', url); link.setAttribute('download', `SoThuChi_${
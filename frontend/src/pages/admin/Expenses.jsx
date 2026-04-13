import React, { useState, useEffect, useRef } from 'react';
import { Receipt, Plus, Edit2, Trash2, Search, Settings, FileText, Calendar, IndianRupee, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, formatCurrency, formatDate, uploadFile, deleteFile, getSignedUrl } from '../../lib/supabaseClient';
import Sidebar from '../../components/Sidebar';
import TopBar from '../../components/TopBar';
import Button from '../../components/Button';
import InputField from '../../components/InputField';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';
import toast from 'react-hot-toast';
import { useAdminActiveApartment } from '../../hooks/useAdminActiveApartment';

const Expenses = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const seededDefaultCategoriesRef = useRef(null);
  
  const [formData, setFormData] = useState({
    amount: '',
    category: '',
    description: '',
    vendor_name: '',
    date: new Date().toISOString().split('T')[0],
    payment_mode: 'cash',
    reference_number: '',
    attachment: null,
  });

  const { userProfile, profileLoaded } = useAuth();
  const activeApartmentId = useAdminActiveApartment();

  useEffect(() => {
    if (activeApartmentId) {
      fetchExpenses();
      fetchCategories();
    } else if (profileLoaded) {
      setLoading(false);
    }
  }, [activeApartmentId, profileLoaded]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('apartment_id', activeApartmentId)
        .order('date', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('apartment_id', activeApartmentId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      const rows = data || [];
      setCategories(rows);

      // If this apartment has no categories yet, seed sensible defaults once.
      if (rows.length === 0 && seededDefaultCategoriesRef.current !== activeApartmentId) {
        seededDefaultCategoriesRef.current = activeApartmentId;
        await createDefaultCategories();
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'attachment') {
      setFormData({ ...formData, attachment: files[0] });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (!formData.category) {
      toast.error('Please select a category');
      return;
    }

    try {
      setLoading(true);
      let attachmentUrl = null;
      let attachmentName = null;

      if (formData.attachment) {
        setUploadingFile(true);
        const fileData = await uploadFile(formData.attachment, `expenses/${activeApartmentId}`);
        attachmentUrl = fileData.path;
        attachmentName = fileData.name;
        setUploadingFile(false);
      }

      const expenseData = {
        apartment_id: activeApartmentId,
        amount: parseFloat(formData.amount),
        category: formData.category,
        description: formData.description || null,
        vendor_name: formData.vendor_name || null,
        date: formData.date,
        payment_mode: formData.payment_mode,
        reference_number: formData.reference_number || null,
        attachment_url: attachmentUrl || editingExpense?.attachment_url,
        attachment_name: attachmentName || editingExpense?.attachment_name,
        created_by: userProfile.id,
      };

      if (editingExpense) {
        if (attachmentUrl && editingExpense.attachment_url) {
          await deleteFile(editingExpense.attachment_url);
        }

        const { error } = await supabase
          .from('expenses')
          .update(expenseData)
          .eq('id', editingExpense.id);

        if (error) throw error;
        toast.success('Expense updated successfully');
      } else {
        const { error } = await supabase
          .from('expenses')
          .insert(expenseData);

        if (error) throw error;
        toast.success('Expense added successfully');
      }

      setShowModal(false);
      resetForm();
      fetchExpenses();
    } catch (error) {
      console.error('Error saving expense:', error);
      toast.error('Failed to save expense');
    } finally {
      setLoading(false);
      setUploadingFile(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('Please enter a category name');
      return;
    }

    try {
      const { error } = await supabase
        .from('expense_categories')
        .insert({
          apartment_id: activeApartmentId,
          name: newCategoryName.trim(),
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('This category already exists');
        } else {
          throw error;
        }
        return;
      }

      toast.success('Category added successfully');
      setNewCategoryName('');
      fetchCategories();
    } catch (error) {
      console.error('Error adding category:', error);
      toast.error('Failed to add category');
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!confirm('Are you sure you want to delete this category?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('expense_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Category deleted successfully');
      fetchCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Failed to delete category');
    }
  };

  const createDefaultCategories = async () => {
    const defaultCategories = [
      'Electricity Bill',
      'Water Bill',
      'Maintenance',
      'Security',
      'Cleaning',
      'Pest Control',
      'Elevator Maintenance',
      'Generator Fuel',
      'Common Area Electricity',
      'Gardening',
      'Plumbing',
      'Painting',
      'Repair Work',
      'Insurance',
      'Property Tax',
      'Club House',
      'Parking',
      'Other'
    ];

    try {
      for (const categoryName of defaultCategories) {
        const { error } = await supabase
          .from('expense_categories')
          .insert({
            apartment_id: activeApartmentId,
            name: categoryName,
          })
          .select();

        if (error && error.code !== '23505') {
          console.warn(`Failed to add category ${categoryName}:`, error);
        }
      }
      toast.success('Default categories added successfully');
      fetchCategories();
    } catch (error) {
      console.error('Error creating default categories:', error);
      toast.error('Failed to create default categories');
    }
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setFormData({
      amount: expense.amount.toString(),
      category: expense.category,
      description: expense.description || '',
      vendor_name: expense.vendor_name || '',
      date: expense.date,
      payment_mode: expense.payment_mode || 'cash',
      reference_number: expense.reference_number || '',
      attachment: null,
    });
    setShowModal(true);
  };

  const handleDelete = async (id, attachmentUrl) => {
    if (!confirm('Are you sure you want to delete this expense?')) {
      return;
    }

    try {
      if (attachmentUrl) {
        await deleteFile(attachmentUrl);
      }

      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Expense deleted successfully');
      fetchExpenses();
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast.error('Failed to delete expense');
    }
  };

  const handleViewAttachment = async (attachmentUrl) => {
    try {
      const signedUrl = await getSignedUrl(attachmentUrl);
      if (signedUrl) {
        window.open(signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Error viewing attachment:', error);
      toast.error('Failed to view attachment');
    }
  };

  const resetForm = () => {
    setFormData({
      amount: '',
      category: '',
      description: '',
      vendor_name: '',
      date: new Date().toISOString().split('T')[0],
      payment_mode: 'cash',
      reference_number: '',
      attachment: null,
    });
    setEditingExpense(null);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  const filteredExpenses = expenses.filter(item => {
    const matchesSearch = searchTerm === '' || 
      item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;

    const matchesMonth = selectedMonth === 'all' || 
      new Date(item.date).getMonth() + 1 === parseInt(selectedMonth);

    return matchesSearch && matchesCategory && matchesMonth;
  });

  const totalAmount = filteredExpenses.reduce((sum, item) => sum + Number(item.amount), 0);

  const months = [
    { value: 'all', label: 'All Months' },
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} role={userProfile?.role} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)} title="Expenses" />
        
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
            <p className="text-gray-500 mt-1">Record and manage apartment expenses</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Button
              variant="outline"
              icon={Settings}
              onClick={() => setShowCategoryModal(true)}
            >
              Manage Categories
            </Button>
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => setShowModal(true)}
            >
              Add Expense
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search expenses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {months.map(month => (
                <option key={month.value} value={month.value}>{month.label}</option>
              ))}
            </select>
          </div>

          {/* Summary Card */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">
                  Total Expenses {selectedMonth !== 'all' || selectedCategory !== 'all' ? '(Filtered)' : '(All Time)'}
                </p>
                <p className="text-3xl font-bold text-red-600 mt-1">
                  {formatCurrency(totalAmount)}
                </p>
              </div>
              <div className="p-4 bg-red-100 rounded-lg">
                <Receipt className="text-red-600" size={32} />
              </div>
            </div>
          </div>

          {loading && expenses.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="spinner"></div>
            </div>
          ) : filteredExpenses.length === 0 && !searchTerm && selectedCategory === 'all' ? (
            <EmptyState
              icon={Receipt}
              title="No expenses added yet"
              message="Click Add Expense to record your first expense entry"
              actionLabel="Add Expense"
              onAction={() => setShowModal(true)}
              actionIcon={Plus}
            />
          ) : filteredExpenses.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No results found"
              message="No expenses match your filters"
            />
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Date</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Category</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Vendor</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Description</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Amount</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Payment</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Attachment</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredExpenses.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {formatDate(item.date)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {item.vendor_name || '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 max-w-xs truncate">
                          {item.description || '-'}
                        </td>
                        <td className="py-3 px-4 text-sm font-semibold text-red-600">
                          {formatCurrency(item.amount)}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 capitalize">
                          {item.payment_mode?.replace('_', ' ')}
                        </td>
                        <td className="py-3 px-4">
                          {item.attachment_url ? (
                            <button
                              onClick={() => handleViewAttachment(item.attachment_url)}
                              className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1"
                            >
                              <FileText size={16} />
                              View
                            </button>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEdit(item)}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id, item.attachment_url)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Add/Edit Expense Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingExpense ? 'Edit Expense' : 'Add New Expense'}
        subtitle={editingExpense ? 'Update expense details' : 'Record a new expense entry'}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <InputField
              label="Amount"
              type="number"
              name="amount"
              placeholder="0.00"
              value={formData.amount}
              onChange={handleChange}
              icon={IndianRupee}
              required
              min="0"
              step="0.01"
            />

            <InputField
              label="Date"
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              icon={Calendar}
              required
            />
          </div>

          <InputField
            label="Category"
            type="select"
            name="category"
            value={formData.category}
            onChange={handleChange}
            required
            options={[
              { value: '', label: 'Select Category' },
              ...categories.map(cat => ({ value: cat.name, label: cat.name })),
            ]}
          />

          <InputField
            label="Vendor Name"
            type="text"
            name="vendor_name"
            placeholder="Enter vendor/payee name"
            value={formData.vendor_name}
            onChange={handleChange}
          />

          <InputField
            label="Payment Mode"
            type="select"
            name="payment_mode"
            value={formData.payment_mode}
            onChange={handleChange}
            options={[
              { value: 'cash', label: 'Cash' },
              { value: 'upi', label: 'UPI' },
              { value: 'bank_transfer', label: 'Bank Transfer' },
              { value: 'cheque', label: 'Cheque' },
              { value: 'online', label: 'Online' },
            ]}
          />

          <InputField
            label="Reference Number"
            type="text"
            name="reference_number"
            placeholder="Transaction ID / Bill No"
            value={formData.reference_number}
            onChange={handleChange}
          />

          <InputField
            label="Description"
            type="textarea"
            name="description"
            placeholder="Add notes or description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bill Attachment {editingExpense?.attachment_url && '(Current file will be replaced)'}
            </label>
            <input
              type="file"
              name="attachment"
              onChange={handleChange}
              accept=".pdf,.jpg,.jpeg,.png"
              className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
            />
            <p className="text-xs text-gray-500 mt-1">PDF, JPG, PNG (Max 5MB)</p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseModal}
              fullWidth
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={loading || uploadingFile}
              fullWidth
            >
              {uploadingFile ? 'Uploading...' : editingExpense ? 'Update' : 'Add'} Expense
            </Button>
          </div>
        </form>
      </Modal>

      {/* Manage Categories Modal */}
      <Modal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        title="Manage Expense Categories"
        subtitle="Add or remove expense categories"
      >
        <div className="space-y-5">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="New category name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="flex-1 bg-gray-100 border-0 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500"
              onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
            />
            <Button variant="primary" onClick={handleAddCategory}>
              Add
            </Button>
            <Button variant="outline" onClick={createDefaultCategories}>
              Add Defaults
            </Button>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {categories.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No categories added yet</p>
            ) : (
              <ul className="space-y-2">
                {categories.map((cat) => (
                  <li
                    key={cat.id}
                    className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3"
                  >
                    <span className="text-gray-900">{cat.name}</span>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setShowCategoryModal(false)}
              fullWidth
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Expenses;

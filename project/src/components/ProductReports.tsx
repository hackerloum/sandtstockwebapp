import React, { useState, useEffect } from 'react';
import { FileText, Search, Filter, Eye, CheckCircle, XCircle, Clock, Plus } from 'lucide-react';
import { ProductReport } from '../types';
import { getProductReports, updateProductReportStatus, testProductReportsConnection, checkUserPermissions, testFetchUser } from '../lib/supabase';
import { formatCurrency, formatDate } from '../utils/stockUtils';
import { PageHeader, PageContainer, PageSection, EmptyState } from './shared/PageLayout';
import { Button } from './shared/Button';
import { Table } from './shared/Table';
import { Input, Select } from './shared/Form';
import { ProductReportForm } from './ProductReportForm';

interface ProductReportsProps {
  products: any[];
}

export const ProductReports: React.FC<ProductReportsProps> = ({ products }) => {
  const [reports, setReports] = useState<ProductReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const initializeReports = async () => {
      // Check user permissions first
      const userProfile = await checkUserPermissions();
      console.log('User profile for reports:', userProfile);
      
      // Test connection
      const connectionSuccess = await testProductReportsConnection();
      console.log('Product reports connection test result:', connectionSuccess);
      
      if (connectionSuccess) {
        fetchReports();
      }
    };
    
    initializeReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      console.log('Fetching product reports...');
      const data = await getProductReports();
      console.log('Fetched reports data:', data);
      console.log('Reports count:', data.length);
      
      // Test fetching the specific user from the report
      if (data.length > 0 && data[0].reported_by) {
        console.log('Testing fetch for reporter:', data[0].reported_by);
        const userData = await testFetchUser(data[0].reported_by);
        console.log('Test user fetch result:', userData);
      }
      
      setReports(data);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = reports.filter(report => {
    const matchesSearch = 
      report.product?.commercial_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.reporter?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || report.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const columns = [
    {
      key: 'product',
      header: 'Product',
      render: (report: ProductReport) => (
        <div>
          <div className="font-medium">{report.product?.commercial_name || 'Unknown'}</div>
          <div className="text-sm text-gray-500">{report.product?.code || 'No Code'}</div>
        </div>
      )
    },
    {
      key: 'reporter',
      header: 'Reported By',
      render: (report: ProductReport) => report.reporter?.full_name || 'Unknown'
    },
    {
      key: 'type',
      header: 'Type',
      render: (report: ProductReport) => (
        <span className={`px-2 py-1 text-xs rounded-full ${
          report.report_type === 'add' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {report.report_type}
        </span>
      )
    },
    {
      key: 'quantity',
      header: 'Quantity',
      render: (report: ProductReport) => report.quantity
    },
    {
      key: 'status',
      header: 'Status',
      render: (report: ProductReport) => (
        <span className={`px-2 py-1 text-xs rounded-full ${
          report.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
          report.status === 'approved' ? 'bg-green-100 text-green-800' :
          'bg-red-100 text-red-800'
        }`}>
          {report.status}
        </span>
      )
    },
    {
      key: 'created_at',
      header: 'Date',
      render: (report: ProductReport) => formatDate(report.created_at)
    }
  ];

  if (showForm) {
    return (
      <ProductReportForm
        products={products}
        onBack={() => {
          setShowForm(false);
          fetchReports();
        }}
      />
    );
  }

  if (loading) {
    return (
      <PageContainer>
        <PageHeader title="Product Reports" subtitle="Manage product reports" />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading reports...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Reports"
        subtitle="Manage product addition and removal requests"
      />

      {/* Debug Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <h3 className="text-sm font-medium text-blue-800 mb-2">Debug Info</h3>
        <p className="text-sm text-blue-700">Total reports: {reports.length}</p>
        <p className="text-sm text-blue-700">Loading: {loading ? 'Yes' : 'No'}</p>
        <p className="text-sm text-blue-700">Filtered reports: {filteredReports.length}</p>
        {reports.length > 0 && (
          <div className="mt-2">
            <p className="text-sm text-blue-700">Sample report:</p>
            <pre className="text-xs text-blue-600 bg-blue-100 p-2 rounded mt-1 overflow-auto">
              {JSON.stringify(reports[0], null, 2)}
            </pre>
          </div>
        )}
      </div>

      <PageContainer>
        <PageSection>
          <div className="bg-white rounded-lg border p-4 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Filters</h3>
              <Button
                variant="primary"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => setShowForm(true)}
              >
                Submit New Report
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                             <Input
                 type="text"
                 placeholder="Search reports..."
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
               />
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'All Status' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'rejected', label: 'Rejected' }
                ]}
              />
              <Button
                variant="secondary"
                icon={<Filter className="w-4 h-4" />}
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </PageSection>

        <PageSection>
          <Table
            data={filteredReports}
            columns={columns}
            emptyState={
              <EmptyState
                icon={<FileText className="w-16 h-16" />}
                title="No reports found"
                description="No product reports match your current filters."
              />
            }
          />
        </PageSection>
      </PageContainer>
    </div>
  );
}; 
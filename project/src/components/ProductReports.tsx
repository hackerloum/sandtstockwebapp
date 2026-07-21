import React, { useState, useEffect } from 'react';
import { FileText, Filter, Plus } from 'lucide-react';
import { Product, ProductReport } from '../types';
import { getProductReports, testProductReportsConnection, checkUserPermissions, testFetchUser } from '../lib/supabase';
import { formatDate } from '../utils/stockUtils';
import { PageHeader, PageContainer, PageSection, EmptyState } from './shared/PageLayout';
import { Button } from './shared/Button';
import { Table } from './shared/Table';
import { Input, Select } from './shared/Form';
import { ProductReportForm } from './ProductReportForm';

interface ProductReportsProps {
  products: Product[];
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
    <div className="space-y-5">
      <PageHeader
        title="Product reports"
        subtitle="Manage product addition and removal requests"
        actions={
          <Button
            variant="primary"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setShowForm(true)}
          >
            New report
          </Button>
        }
      />

      <PageContainer>
        <PageSection title="Requests" description={`${filteredReports.length} of ${reports.length} reports`}>
            <div className="mb-5 grid grid-cols-1 gap-3 border-b border-gray-200 pb-5 md:grid-cols-3">
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
                Clear filters
              </Button>
            </div>
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

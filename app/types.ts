export interface Contractor {
  id: string;
  sequentialNumber: number;
  name: string;
  inn: string;
  kpp: string | null;
  legalAddress: string;
  contactPersonName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  status: 'active' | 'pending' | 'blocked';
  _count?: { employees: number };
}

export interface Employee {
  id: string;
  contractorId: string;
  fullName: string;
  position: string;
  photo?: string;
  passportSeries: string;
  passportNumber: string;
  documents: EmployeeDocument[];
  workClasses: string[];
  approvals: Approval[];
}

export interface EmployeeDocument {
  id: string;
  name: string;
  issueDate: string;
  expiryDate: string;
  status: 'valid' | 'expiring' | 'expired';
}

export interface Approval {
  id: string;
  department: 'security' | 'hr' | 'safety' | 'safety_training' | 'permit_bureau';
  departmentName: string;
  status: 'approved' | 'pending' | 'rejected';
  deadline: string;
  comment?: string;
}

export interface Permit {
  id: string;
  permitNumber: string;
  category: string;
  contractorName: string;
  contractorNumber: string;
  curatorNumber: string;
  sequentialNumber: string;
  openDate: string;
  expiryDate: string;
  workSite: string;
  responsiblePerson: string;
  status: 'open' | 'closed' | 'early_closed';
  closeReason?: string;
}

export interface Violation {
  id: string;
  violationNumber: string;
  contractorName: string;
  date: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'resolved' | 'escalated';
  department?: string;
}

export interface Checklist {
  id: string;
  contractorName: string;
  date: string;
  inspector: string;
  totalItems: number;
  passedItems: number;
  score: number;
  status: 'passed' | 'failed' | 'in_progress';
}

export interface NormDocument {
  id: string;
  title: string;
  category: string;
  type: 'pdf' | 'docx' | 'xlsx';
  updatedAt: string;
}

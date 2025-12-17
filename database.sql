-- Estrutura do banco de dados SQLite para PsicoGestão

-- Tabela de usuários
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    role TEXT DEFAULT 'psychologist',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT 1
);

-- Tabela de pacientes
CREATE TABLE patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    birth_date DATE NOT NULL,
    gender TEXT,
    cpf_encrypted TEXT, -- CPF criptografado
    phone_encrypted TEXT, -- Telefone criptografado
    email_encrypted TEXT, -- Email criptografado
    address_encrypted TEXT, -- Endereço criptografado
    profession TEXT,
    emergency_contact TEXT,
    health_insurance TEXT,
    status TEXT DEFAULT 'active',
    first_session_date DATE,
    session_frequency TEXT DEFAULT 'weekly',
    therapy_reason TEXT,
    observations TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    is_deleted BOOLEAN DEFAULT 0,
    deletion_reason TEXT,
    deleted_at TIMESTAMP
);

-- Tabela de sessões/consultas
CREATE TABLE appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL REFERENCES patients(id),
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    duration INTEGER DEFAULT 50,
    type TEXT DEFAULT 'individual',
    status TEXT DEFAULT 'scheduled',
    notes TEXT,
    price DECIMAL(10,2),
    payment_status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);

-- Tabela de pagamentos
CREATE TABLE payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL REFERENCES patients(id),
    appointment_id INTEGER REFERENCES appointments(id),
    payment_date DATE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method TEXT,
    payment_type TEXT DEFAULT 'session',
    description TEXT,
    receipt_number TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);

-- Tabela de relatórios clínicos
CREATE TABLE reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL REFERENCES patients(id),
    appointment_id INTEGER REFERENCES appointments(id),
    report_date DATE NOT NULL,
    report_type TEXT DEFAULT 'session',
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author_id INTEGER REFERENCES users(id),
    confidentiality_level TEXT DEFAULT 'confidential',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT 0
);

-- Tabela de anotações clínicas
CREATE TABLE clinical_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL REFERENCES patients(id),
    note_date DATE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT,
    tags TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);

-- Tabela de documentos
CREATE TABLE documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER REFERENCES patients(id),
    document_name TEXT NOT NULL,
    document_type TEXT NOT NULL,
    file_path TEXT,
    file_size INTEGER,
    mime_type TEXT,
    description TEXT,
    confidentiality_level TEXT DEFAULT 'confidential',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    uploaded_by INTEGER REFERENCES users(id),
    folder_id INTEGER DEFAULT NULL
);

-- Tabela de pastas
CREATE TABLE folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folder_name TEXT NOT NULL,
    folder_type TEXT NOT NULL,
    parent_folder_id INTEGER DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);

-- Tabela de atividades (log de auditoria)
CREATE TABLE activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    activity_type TEXT NOT NULL,
    activity_description TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    patient_id INTEGER REFERENCES patients(id),
    table_name TEXT,
    record_id INTEGER,
    old_values TEXT,
    new_values TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de configurações
CREATE TABLE settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key TEXT UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type TEXT DEFAULT 'text',
    category TEXT DEFAULT 'general',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de backups
CREATE TABLE backups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    backup_name TEXT NOT NULL,
    backup_type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    encryption_key_hash TEXT
);

-- Tabela de consentimentos LGPD
CREATE TABLE consents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL REFERENCES patients(id),
    consent_type TEXT NOT NULL,
    consent_text TEXT NOT NULL,
    given_by TEXT,
    relationship TEXT,
    consent_date DATE NOT NULL,
    expiry_date DATE,
    is_active BOOLEAN DEFAULT 1,
    digital_signature TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);

-- Tabela de logs de acesso
CREATE TABLE access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id INTEGER,
    ip_address TEXT,
    user_agent TEXT,
    success BOOLEAN,
    failure_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX idx_patients_status ON patients(status);
CREATE INDEX idx_patients_created ON patients(created_at);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_payments_date ON payments(payment_date);
CREATE INDEX idx_reports_patient ON reports(patient_id);
CREATE INDEX idx_activities_created ON activities(created_at);
CREATE INDEX idx_access_logs_user ON access_logs(user_id);
CREATE INDEX idx_access_logs_created ON access_logs(created_at);

-- Insert do usuário padrão (senha: Andrea1103#)
-- A senha deve ser hashada com bcrypt no código
INSERT INTO users (username, password_hash, full_name, email, role) 
VALUES ('Andrea', '$2b$10$YourBcryptHashHere', 'Andrea', 'andrea@email.com', 'psychologist');

-- Configurações padrão
INSERT INTO settings (setting_key, setting_value, category) VALUES
('system_name', 'PsicoGestão', 'general'),
('session_timeout', '30', 'security'),
('max_login_attempts', '3', 'security'),
('backup_frequency', 'daily', 'backup'),
('data_retention_years', '5', 'lgpd'),
('encryption_enabled', '1', 'security'),
('auto_logout', '1', 'security');
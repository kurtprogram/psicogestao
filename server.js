const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const cors = require('cors');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'sua-chave-secreta-super-forte-aqui';

// Configurar banco de dados
const db = new sqlite3.Database('./database.sqlite');

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:8080',
    credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100 // limite de requisições por IP
});
app.use('/api/', limiter);

// Middleware de autenticação
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// Funções auxiliares para criptografia
function encrypt(text) {
    return Buffer.from(text).toString('base64');
}

function decrypt(encrypted) {
    return Buffer.from(encrypted, 'base64').toString('utf-8');
}

// ============================================
// ROTAS PÚBLICAS
// ============================================

// Rota de login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        db.get('SELECT * FROM users WHERE username = ? AND is_active = 1', [username], async (err, user) => {
            if (err || !user) {
                return res.status(401).json({ error: 'Credenciais inválidas' });
            }

            const validPassword = await bcrypt.compare(password, user.password_hash);
            if (!validPassword) {
                return res.status(401).json({ error: 'Credenciais inválidas' });
            }

            // Atualizar último login
            db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

            // Gerar token JWT
            const token = jwt.sign(
                { 
                    id: user.id, 
                    username: user.username,
                    full_name: user.full_name,
                    role: user.role 
                },
                SECRET_KEY,
                { expiresIn: '8h' }
            );

            res.json({
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    full_name: user.full_name,
                    email: user.email,
                    role: user.role
                }
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

// Rota de registro (apenas para desenvolvimento)
app.post('/api/register', async (req, res) => {
    const { username, password, full_name, email } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        db.run(
            `INSERT INTO users (username, password_hash, full_name, email) VALUES (?, ?, ?, ?)`,
            [username, hashedPassword, full_name, email],
            function(err) {
                if (err) {
                    return res.status(400).json({ error: 'Usuário já existe' });
                }
                res.json({ message: 'Usuário criado com sucesso' });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

// ============================================
// ROTAS PROTEGIDAS (requerem autenticação)
// ============================================

// Middleware para todas as rotas abaixo
app.use('/api/data', authenticateToken);

// Pacientes
app.get('/api/data/patients', (req, res) => {
    db.all(
        `SELECT * FROM patients WHERE is_deleted = 0 ORDER BY created_at DESC`,
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            // Decriptar dados sensíveis
            const patients = rows.map(patient => ({
                ...patient,
                phone: patient.phone_encrypted ? decrypt(patient.phone_encrypted) : '',
                email: patient.email_encrypted ? decrypt(patient.email_encrypted) : '',
                address: patient.address_encrypted ? decrypt(patient.address_encrypted) : '',
                cpf: patient.cpf_encrypted ? decrypt(patient.cpf_encrypted) : ''
            }));
            
            res.json(patients);
        }
    );
});

app.post('/api/data/patients', (req, res) => {
    const {
        first_name, last_name, birth_date, gender, cpf, phone, email,
        address, profession, emergency_contact, health_insurance,
        session_frequency, therapy_reason, observations
    } = req.body;

    const patientData = {
        first_name,
        last_name,
        birth_date,
        gender,
        cpf_encrypted: cpf ? encrypt(cpf) : null,
        phone_encrypted: phone ? encrypt(phone) : null,
        email_encrypted: email ? encrypt(email) : null,
        address_encrypted: address ? encrypt(address) : null,
        profession,
        emergency_contact,
        health_insurance,
        session_frequency: session_frequency || 'weekly',
        therapy_reason,
        observations,
        first_session_date: new Date().toISOString().split('T')[0],
        created_by: req.user.id
    };

    const columns = Object.keys(patientData);
    const values = Object.values(patientData);
    const placeholders = columns.map(() => '?').join(', ');

    db.run(
        `INSERT INTO patients (${columns.join(', ')}) VALUES (${placeholders})`,
        values,
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            // Retornar o paciente criado
            db.get(
                `SELECT * FROM patients WHERE id = ?`,
                [this.lastID],
                (err, row) => {
                    if (err) return res.status(500).json({ error: err.message });
                    
                    const patient = {
                        ...row,
                        phone: row.phone_encrypted ? decrypt(row.phone_encrypted) : '',
                        email: row.email_encrypted ? decrypt(row.email_encrypted) : '',
                        address: row.address_encrypted ? decrypt(row.address_encrypted) : '',
                        cpf: row.cpf_encrypted ? decrypt(row.cpf_encrypted) : ''
                    };
                    
                    // Log de atividade
                    logActivity(req.user.id, 'create', 'patients', this.lastID, 'Novo paciente criado');
                    
                    res.json(patient);
                }
            );
        }
    );
});

// Atualizar paciente
app.put('/api/data/patients/:id', (req, res) => {
    const id = req.params.id;
    const {
        first_name, last_name, birth_date, gender, cpf, phone, email,
        address, profession, emergency_contact, health_insurance,
        session_frequency, therapy_reason, observations, status
    } = req.body;

    const updates = {
        first_name,
        last_name,
        birth_date,
        gender,
        cpf_encrypted: cpf ? encrypt(cpf) : null,
        phone_encrypted: phone ? encrypt(phone) : null,
        email_encrypted: email ? encrypt(email) : null,
        address_encrypted: address ? encrypt(address) : null,
        profession,
        emergency_contact,
        health_insurance,
        session_frequency,
        therapy_reason,
        observations,
        status,
        updated_at: new Date().toISOString()
    };

    // Filtrar campos nulos/undefined
    const filteredUpdates = Object.entries(updates)
        .filter(([_, value]) => value !== undefined && value !== null)
        .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});

    const setClause = Object.keys(filteredUpdates)
        .map(key => `${key} = ?`)
        .join(', ');
    
    const values = [...Object.values(filteredUpdates), id];

    db.run(
        `UPDATE patients SET ${setClause} WHERE id = ?`,
        values,
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            // Log de atividade
            logActivity(req.user.id, 'update', 'patients', id, 'Paciente atualizado');
            
            res.json({ message: 'Paciente atualizado com sucesso' });
        }
    );
});

// Excluir paciente (soft delete)
app.delete('/api/data/patients/:id', (req, res) => {
    const id = req.params.id;
    const { deletion_reason } = req.body;

    db.run(
        `UPDATE patients SET is_deleted = 1, deletion_reason = ?, deleted_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [deletion_reason, id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            // Log de atividade
            logActivity(req.user.id, 'delete', 'patients', id, 'Paciente excluído');
            
            res.json({ message: 'Paciente excluído com sucesso' });
        }
    );
});

// Consultas
app.get('/api/data/appointments', (req, res) => {
    const { date, patient_id } = req.query;
    
    let query = `
        SELECT a.*, p.first_name, p.last_name 
        FROM appointments a
        LEFT JOIN patients p ON a.patient_id = p.id
        WHERE p.is_deleted = 0
    `;
    
    const params = [];
    
    if (date) {
        query += ` AND a.appointment_date = ?`;
        params.push(date);
    }
    
    if (patient_id) {
        query += ` AND a.patient_id = ?`;
        params.push(patient_id);
    }
    
    query += ` ORDER BY a.appointment_date, a.appointment_time`;
    
    db.all(query, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.post('/api/data/appointments', (req, res) => {
    const {
        patient_id, appointment_date, appointment_time, duration,
        type, notes, price
    } = req.body;

    // Validar horário para o mesmo dia
    const today = new Date().toISOString().split('T')[0];
    const [hours, minutes] = appointment_time.split(':').map(Number);
    const appointmentDateTime = new Date(`${appointment_date}T${appointment_time}`);
    
    if (appointment_date === today) {
        const now = new Date();
        if (appointmentDateTime < now) {
            return res.status(400).json({ error: 'Não é possível agendar consultas para horários passados no mesmo dia' });
        }
    }

    db.run(
        `INSERT INTO appointments 
         (patient_id, appointment_date, appointment_time, duration, type, notes, price, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [patient_id, appointment_date, appointment_time, duration, type, notes, price, req.user.id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            // Log de atividade
            logActivity(req.user.id, 'create', 'appointments', this.lastID, 'Nova consulta agendada');
            
            // Buscar dados completos da consulta
            db.get(
                `SELECT a.*, p.first_name, p.last_name 
                 FROM appointments a
                 LEFT JOIN patients p ON a.patient_id = p.id
                 WHERE a.id = ?`,
                [this.lastID],
                (err, row) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json(row);
                }
            );
        }
    );
});

// Atualizar status da consulta
app.put('/api/data/appointments/:id/status', (req, res) => {
    const id = req.params.id;
    const { status } = req.body;

    db.run(
        `UPDATE appointments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [status, id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            // Log de atividade
            logActivity(req.user.id, 'update', 'appointments', id, `Status da consulta alterado para ${status}`);
            
            res.json({ message: 'Status atualizado com sucesso' });
        }
    );
});

// Relatórios
app.get('/api/data/reports', (req, res) => {
    db.all(
        `SELECT r.*, p.first_name, p.last_name, u.full_name as author_name
         FROM reports r
         LEFT JOIN patients p ON r.patient_id = p.id
         LEFT JOIN users u ON r.author_id = u.id
         WHERE r.is_deleted = 0
         ORDER BY r.report_date DESC`,
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json(rows);
        }
    );
});

app.post('/api/data/reports', (req, res) => {
    const {
        patient_id, appointment_id, report_date, report_type,
        title, content, confidentiality_level
    } = req.body;

    db.run(
        `INSERT INTO reports 
         (patient_id, appointment_id, report_date, report_type, title, content, 
          author_id, confidentiality_level) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [patient_id, appointment_id, report_date, report_type, title, content, req.user.id, confidentiality_level],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            // Log de atividade
            logActivity(req.user.id, 'create', 'reports', this.lastID, 'Novo relatório criado');
            
            res.json({ id: this.lastID, message: 'Relatório criado com sucesso' });
        }
    );
});

// Pagamentos
app.get('/api/data/payments', (req, res) => {
    db.all(
        `SELECT p.*, pt.first_name, pt.last_name, a.appointment_date
         FROM payments p
         LEFT JOIN patients pt ON p.patient_id = pt.id
         LEFT JOIN appointments a ON p.appointment_id = a.id
         ORDER BY p.payment_date DESC`,
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json(rows);
        }
    );
});

app.post('/api/data/payments', (req, res) => {
    const {
        patient_id, appointment_id, payment_date, amount,
        payment_method, payment_type, description, receipt_number
    } = req.body;

    db.run(
        `INSERT INTO payments 
         (patient_id, appointment_id, payment_date, amount, payment_method, 
          payment_type, description, receipt_number, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [patient_id, appointment_id, payment_date, amount, payment_method, 
         payment_type, description, receipt_number, req.user.id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            // Log de atividade
            logActivity(req.user.id, 'create', 'payments', this.lastID, 'Novo pagamento registrado');
            
            // Se for de uma consulta, atualizar status de pagamento
            if (appointment_id) {
                db.run(
                    `UPDATE appointments SET payment_status = 'paid' WHERE id = ?`,
                    [appointment_id]
                );
            }
            
            res.json({ id: this.lastID, message: 'Pagamento registrado com sucesso' });
        }
    );
});

// Anotações clínicas
app.get('/api/data/clinical-notes/:patient_id', (req, res) => {
    const patient_id = req.params.patient_id;
    
    db.all(
        `SELECT cn.*, u.full_name as author_name
         FROM clinical_notes cn
         LEFT JOIN users u ON cn.created_by = u.id
         WHERE cn.patient_id = ?
         ORDER BY cn.note_date DESC`,
        [patient_id],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json(rows);
        }
    );
});

app.post('/api/data/clinical-notes', (req, res) => {
    const {
        patient_id, note_date, title, content, category, tags
    } = req.body;

    db.run(
        `INSERT INTO clinical_notes 
         (patient_id, note_date, title, content, category, tags, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [patient_id, note_date, title, content, category, tags, req.user.id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            // Log de atividade
            logActivity(req.user.id, 'create', 'clinical_notes', this.lastID, 'Nova anotação clínica');
            
            res.json({ id: this.lastID, message: 'Anotação criada com sucesso' });
        }
    );
});

// Pastas
app.get('/api/data/folders', (req, res) => {
    const { folder_type } = req.query;
    
    let query = `SELECT * FROM folders WHERE 1=1`;
    const params = [];
    
    if (folder_type) {
        query += ` AND folder_type = ?`;
        params.push(folder_type);
    }
    
    query += ` ORDER BY folder_name`;
    
    db.all(query, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.post('/api/data/folders', (req, res) => {
    const { folder_name, folder_type, parent_folder_id } = req.body;

    db.run(
        `INSERT INTO folders (folder_name, folder_type, parent_folder_id, created_by) 
         VALUES (?, ?, ?, ?)`,
        [folder_name, folder_type, parent_folder_id, req.user.id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            // Log de atividade
            logActivity(req.user.id, 'create', 'folders', this.lastID, 'Nova pasta criada');
            
            res.json({ id: this.lastID, message: 'Pasta criada com sucesso' });
        }
    );
});

// Documentos
app.get('/api/data/documents', (req, res) => {
    const { folder_id, patient_id } = req.query;
    
    let query = `
        SELECT d.*, f.folder_name, p.first_name, p.last_name
        FROM documents d
        LEFT JOIN folders f ON d.folder_id = f.id
        LEFT JOIN patients p ON d.patient_id = p.id
        WHERE 1=1
    `;
    
    const params = [];
    
    if (folder_id) {
        query += ` AND d.folder_id = ?`;
        params.push(folder_id);
    }
    
    if (patient_id) {
        query += ` AND d.patient_id = ?`;
        params.push(patient_id);
    }
    
    query += ` ORDER BY d.created_at DESC`;
    
    db.all(query, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.post('/api/data/documents', (req, res) => {
    const {
        patient_id, document_name, document_type, file_path,
        file_size, mime_type, description, folder_id
    } = req.body;

    db.run(
        `INSERT INTO documents 
         (patient_id, document_name, document_type, file_path, file_size, 
          mime_type, description, folder_id, uploaded_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [patient_id, document_name, document_type, file_path, file_size,
         mime_type, description, folder_id, req.user.id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            // Log de atividade
            logActivity(req.user.id, 'create', 'documents', this.lastID, 'Novo documento criado');
            
            res.json({ id: this.lastID, message: 'Documento criado com sucesso' });
        }
    );
});

// Upload de arquivos
app.post('/api/data/upload', (req, res) => {
    const { file_data, file_name, file_type, folder_id, description } = req.body;
    
    if (!file_data || !file_name) {
        return res.status(400).json({ error: 'Dados do arquivo são obrigatórios' });
    }
    
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const fileId = Date.now();
    const fileName = `${fileId}_${file_name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const filePath = path.join(uploadDir, fileName);
    
    // Converter base64 para arquivo
    const base64Data = file_data.replace(/^data:.*?;base64,/, '');
    fs.writeFile(filePath, base64Data, 'base64', (err) => {
        if (err) {
            return res.status(500).json({ error: 'Erro ao salvar arquivo' });
        }
        
        const stats = fs.statSync(filePath);
        
        // Salvar no banco
        db.run(
            `INSERT INTO documents 
             (document_name, document_type, file_path, file_size, mime_type, description, folder_id, uploaded_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [file_name, 'file', `/uploads/${fileName}`, stats.size, file_type, description, folder_id, req.user.id],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                
                res.json({
                    id: this.lastID,
                    file_path: `/uploads/${fileName}`,
                    message: 'Arquivo enviado com sucesso'
                });
            }
        );
    });
});

// Dashboard statistics
app.get('/api/data/dashboard', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    
    const stats = {};
    
    // Contar pacientes ativos
    db.get(
        `SELECT COUNT(*) as count FROM patients WHERE status = 'active' AND is_deleted = 0`,
        (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            stats.activePatients = row.count;
            
            // Consultas de hoje
            db.get(
                `SELECT COUNT(*) as count FROM appointments WHERE appointment_date = ?`,
                [today],
                (err, row) => {
                    if (err) return res.status(500).json({ error: err.message });
                    stats.todayAppointments = row.count;
                    
                    // Receita do mês
                    const currentMonth = new Date().getMonth() + 1;
                    const currentYear = new Date().getFullYear();
                    
                    db.get(
                        `SELECT SUM(amount) as total FROM payments 
                         WHERE strftime('%m', payment_date) = ? AND strftime('%Y', payment_date) = ?`,
                        [currentMonth.toString().padStart(2, '0'), currentYear],
                        (err, row) => {
                            if (err) return res.status(500).json({ error: err.message });
                            stats.monthlyRevenue = row.total || 0;
                            
                            // Relatórios pendentes
                            db.get(
                                `SELECT COUNT(*) as count FROM appointments a
                                 LEFT JOIN reports r ON a.id = r.appointment_id
                                 WHERE a.status = 'completed' AND r.id IS NULL`,
                                (err, row) => {
                                    if (err) return res.status(500).json({ error: err.message });
                                    stats.pendingReports = row.count;
                                    
                                    res.json(stats);
                                }
                            );
                        }
                    );
                }
            );
        }
    );
});

// Atividades recentes
app.get('/api/data/activities', (req, res) => {
    db.all(
        `SELECT a.*, u.full_name as user_name, p.first_name as patient_first_name,
                p.last_name as patient_last_name
         FROM activities a
         LEFT JOIN users u ON a.user_id = u.id
         LEFT JOIN patients p ON a.patient_id = p.id
         ORDER BY a.created_at DESC
         LIMIT 20`,
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json(rows);
        }
    );
});

// Log de atividade
function logActivity(userId, activityType, tableName, recordId, description) {
    const ip = '127.0.0.1';
    const userAgent = 'Server';
    
    db.run(
        `INSERT INTO activities 
         (user_id, activity_type, activity_description, ip_address, user_agent,
          table_name, record_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, activityType, description, ip, userAgent, tableName, recordId]
    );
}

// Inicializar banco de dados
function initializeDatabase() {
    const sql = fs.readFileSync('./database.sql', 'utf8');
    
    db.exec(sql, (err) => {
        if (err) {
            console.error('Erro ao inicializar banco de dados:', err);
        } else {
            console.log('Banco de dados inicializado com sucesso');
            
            // Criar usuário padrão se não existir
            const defaultPassword = 'Andrea1103#';
            bcrypt.hash(defaultPassword, 10, (err, hash) => {
                if (err) return;
                
                db.get('SELECT * FROM users WHERE username = ?', ['Andrea'], (err, row) => {
                    if (!row) {
                        db.run(
                            `INSERT INTO users (username, password_hash, full_name, email, role)
                             VALUES (?, ?, ?, ?, ?)`,
                            ['Andrea', hash, 'Andrea', 'andrea@email.com', 'psychologist']
                        );
                    }
                });
            });
        }
    });
}

// Inicializar e iniciar servidor
initializeDatabase();

// Configurar HTTPS (para produção)
if (process.env.NODE_ENV === 'production') {
    const options = {
        key: fs.readFileSync(process.env.SSL_KEY_PATH),
        cert: fs.readFileSync(process.env.SSL_CERT_PATH)
    };
    
    https.createServer(options, app).listen(PORT, () => {
        console.log(`Servidor HTTPS rodando na porta ${PORT}`);
    });
} else {
    app.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}`);
    });
}

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

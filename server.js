const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = crypto.randomBytes(32).toString('hex');

// Configurações de segurança
app.use(helmet());
app.use(cors({
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500'],
    credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100 // limite de 100 requests por IP
});
app.use('/api/', limiter);

// Conectar ao banco SQLite
const db = new sqlite3.Database('./psicogestao.db', (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco:', err);
    } else {
        console.log('Conectado ao banco SQLite');
        initializeDatabase();
    }
});

// Middleware de autenticação
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Token não fornecido' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido' });
        }
        req.user = user;
        next();
    });
}

// Middleware de auditoria
function auditLog(req, res, next) {
    const oldJson = res.json;
    res.json = function(data) {
        if (req.user) {
            const auditData = {
                user_id: req.user.id,
                action: req.method + ' ' + req.path,
                resource_type: req.baseUrl,
                resource_id: req.params.id,
                ip_address: req.ip,
                user_agent: req.get('User-Agent'),
                success: res.statusCode < 400,
                created_at: new Date().toISOString()
            };
            
            db.run(
                `INSERT INTO access_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, success, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [auditData.user_id, auditData.action, auditData.resource_type, auditData.resource_id,
                 auditData.ip_address, auditData.user_agent, auditData.success, auditData.created_at]
            );
        }
        oldJson.call(this, data);
    };
    next();
}

// Inicializar banco de dados
function initializeDatabase() {
    const schema = fs.readFileSync('./database.sql', 'utf8');
    db.exec(schema, (err) => {
        if (err) {
            console.error('Erro ao criar tabelas:', err);
        } else {
            console.log('Banco de dados inicializado');
            
            // Criar usuário padrão se não existir
            const defaultPassword = 'Andrea1103#';
            bcrypt.hash(defaultPassword, 10, (err, hash) => {
                if (err) {
                    console.error('Erro ao hash senha:', err);
                    return;
                }
                
                db.get('SELECT id FROM users WHERE username = ?', ['Andrea'], (err, row) => {
                    if (!row) {
                        db.run(
                            `INSERT INTO users (username, password_hash, full_name, email, role) 
                             VALUES (?, ?, ?, ?, ?)`,
                            ['Andrea', hash, 'Andrea', 'andrea@email.com', 'psychologist'],
                            (err) => {
                                if (err) console.error('Erro ao criar usuário padrão:', err);
                                else console.log('Usuário padrão criado');
                            }
                        );
                    }
                });
            });
        }
    });
}

// Chave de criptografia (deve ser armazenada de forma segura em produção)
const ENCRYPTION_KEY = crypto.scryptSync('chave-mestra-lgpd-2024', 'salt', 32);
const ALGORITHM = 'aes-256-gcm';

// Funções de criptografia LGPD
function encryptText(text) {
    if (!text) return null;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return {
        iv: iv.toString('hex'),
        content: encrypted,
        tag: authTag.toString('hex')
    };
}

function decryptText(encryptedData) {
    if (!encryptedData) return null;
    try {
        const decipher = crypto.createDecipheriv(
            ALGORITHM,
            ENCRYPTION_KEY,
            Buffer.from(encryptedData.iv, 'hex')
        );
        decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
        let decrypted = decipher.update(encryptedData.content, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.error('Erro na descriptografia:', error);
        return null;
    }
}

// ROTAS DA API

// 1. Autenticação
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }
    
    db.get(
        'SELECT id, username, password_hash, full_name, role FROM users WHERE username = ? AND is_active = 1',
        [username],
        async (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Erro no servidor' });
            }
            
            if (!user) {
                return res.status(401).json({ error: 'Credenciais inválidas' });
            }
            
            const isValid = await bcrypt.compare(password, user.password_hash);
            if (!isValid) {
                return res.status(401).json({ error: 'Credenciais inválidas' });
            }
            
            // Atualizar último login
            db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
            
            // Gerar token JWT
            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role },
                JWT_SECRET,
                { expiresIn: '8h' }
            );
            
            res.json({
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    fullName: user.full_name,
                    role: user.role
                }
            });
        }
    );
});

// 2. Pacientes (com criptografia LGPD)
app.post('/api/patients', authenticateToken, auditLog, (req, res) => {
    const patient = req.body;
    
    // Criptografar dados sensíveis
    const cpfEncrypted = encryptText(patient.cpf);
    const phoneEncrypted = encryptText(patient.phone);
    const emailEncrypted = encryptText(patient.email);
    const addressEncrypted = encryptText(patient.address);
    
    db.run(
        `INSERT INTO patients (
            first_name, last_name, birth_date, gender, 
            cpf_encrypted, phone_encrypted, email_encrypted, address_encrypted,
            profession, emergency_contact, health_insurance, status,
            first_session_date, session_frequency, therapy_reason, observations,
            created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            patient.firstName, patient.lastName, patient.birthDate, patient.gender,
            JSON.stringify(cpfEncrypted), JSON.stringify(phoneEncrypted),
            JSON.stringify(emailEncrypted), JSON.stringify(addressEncrypted),
            patient.profession, patient.emergencyContact, patient.healthInsurance,
            patient.status || 'active',
            patient.firstSessionDate, patient.sessionFrequency, patient.therapyReason,
            patient.observations, req.user.id
        ],
        function(err) {
            if (err) {
                console.error('Erro ao criar paciente:', err);
                return res.status(500).json({ error: 'Erro ao criar paciente' });
            }
            
            // Registrar atividade
            db.run(
                `INSERT INTO activities (user_id, activity_type, activity_description, patient_id, table_name, record_id)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [req.user.id, 'create', `Paciente ${patient.firstName} ${patient.lastName} criado`, 
                 this.lastID, 'patients', this.lastID]
            );
            
            res.json({ id: this.lastID, message: 'Paciente criado com sucesso' });
        }
    );
});

app.get('/api/patients', authenticateToken, (req, res) => {
    db.all(
        `SELECT id, first_name, last_name, birth_date, gender, profession, status,
                first_session_date, session_frequency, therapy_reason,
                created_at, updated_at
         FROM patients 
         WHERE is_deleted = 0 
         ORDER BY created_at DESC`,
        [],
        (err, rows) => {
            if (err) {
                console.error('Erro ao buscar pacientes:', err);
                return res.status(500).json({ error: 'Erro ao buscar pacientes' });
            }
            res.json(rows);
        }
    );
});

app.get('/api/patients/:id', authenticateToken, (req, res) => {
    db.get(
        `SELECT *, cpf_encrypted, phone_encrypted, email_encrypted, address_encrypted
         FROM patients WHERE id = ? AND is_deleted = 0`,
        [req.params.id],
        (err, row) => {
            if (err) {
                console.error('Erro ao buscar paciente:', err);
                return res.status(500).json({ error: 'Erro ao buscar paciente' });
            }
            
            if (!row) {
                return res.status(404).json({ error: 'Paciente não encontrado' });
            }
            
            // Descriptografar dados sensíveis
            const patient = { ...row };
            if (patient.cpf_encrypted) {
                patient.cpf = decryptText(JSON.parse(patient.cpf_encrypted));
            }
            if (patient.phone_encrypted) {
                patient.phone = decryptText(JSON.parse(patient.phone_encrypted));
            }
            if (patient.email_encrypted) {
                patient.email = decryptText(JSON.parse(patient.email_encrypted));
            }
            if (patient.address_encrypted) {
                patient.address = decryptText(JSON.parse(patient.address_encrypted));
            }
            
            // Remover dados criptografados da resposta
            delete patient.cpf_encrypted;
            delete patient.phone_encrypted;
            delete patient.email_encrypted;
            delete patient.address_encrypted;
            
            res.json(patient);
        }
    );
});

// 3. Consultas
app.post('/api/appointments', authenticateToken, auditLog, (req, res) => {
    const appointment = req.body;
    
    db.run(
        `INSERT INTO appointments (
            patient_id, appointment_date, appointment_time, duration,
            type, status, notes, price, payment_status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            appointment.patientId, appointment.date, appointment.time, appointment.duration,
            appointment.type, appointment.status || 'scheduled', appointment.notes,
            appointment.price, appointment.paymentStatus || 'pending', req.user.id
        ],
        function(err) {
            if (err) {
                console.error('Erro ao criar consulta:', err);
                return res.status(500).json({ error: 'Erro ao criar consulta' });
            }
            
            res.json({ id: this.lastID, message: 'Consulta agendada com sucesso' });
        }
    );
});

// 4. Relatórios
app.post('/api/reports', authenticateToken, auditLog, (req, res) => {
    const report = req.body;
    
    db.run(
        `INSERT INTO reports (
            patient_id, appointment_id, report_date, report_type,
            title, content, author_id, confidentiality_level
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            report.patientId, report.appointmentId, report.date, report.type,
            report.title, report.content, req.user.id, report.confidentialityLevel || 'confidential'
        ],
        function(err) {
            if (err) {
                console.error('Erro ao criar relatório:', err);
                return res.status(500).json({ error: 'Erro ao criar relatório' });
            }
            
            res.json({ id: this.lastID, message: 'Relatório criado com sucesso' });
        }
    );
});

// 5. Backups automáticos
function performBackup() {
    const backupName = `backup_${Date.now()}.db`;
    const backupPath = path.join(__dirname, 'backups', backupName);
    
    // Copiar banco de dados
    fs.copyFile('./psicogestao.db', backupPath, (err) => {
        if (err) {
            console.error('Erro no backup:', err);
            return;
        }
        
        const stats = fs.statSync(backupPath);
        db.run(
            `INSERT INTO backups (backup_name, backup_type, file_path, file_size, created_by)
             VALUES (?, ?, ?, ?, ?)`,
            [backupName, 'automatic', backupPath, stats.size, 1]
        );
        
        console.log(`Backup realizado: ${backupName}`);
        
        // Limitar a 30 backups
        db.all('SELECT id FROM backups ORDER BY created_at DESC', [], (err, rows) => {
            if (rows.length > 30) {
                const toDelete = rows.slice(30);
                toDelete.forEach(row => {
                    db.get('SELECT file_path FROM backups WHERE id = ?', [row.id], (err, backup) => {
                        if (backup && backup.file_path) {
                            fs.unlink(backup.file_path, () => {});
                        }
                        db.run('DELETE FROM backups WHERE id = ?', [row.id]);
                    });
                });
            }
        });
    });
}

// Agendar backup diário
setInterval(performBackup, 24 * 60 * 60 * 1000); // 24 horas

// 6. Limpeza de dados expirados (LGPD)
function cleanExpiredData() {
    const retentionYears = 5; // Manter dados por 5 anos conforme LGPD
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - retentionYears);
    
    // Anonimizar dados de pacientes inativos há mais de 5 anos
    db.run(
        `UPDATE patients SET 
            first_name = 'ANONIMIZADO',
            last_name = 'ANONIMIZADO',
            cpf_encrypted = NULL,
            phone_encrypted = NULL,
            email_encrypted = NULL,
            address_encrypted = NULL,
            is_deleted = 1,
            deletion_reason = 'LGPD - Retenção expirada',
            deleted_at = CURRENT_TIMESTAMP
         WHERE status = 'inactive' 
         AND updated_at < ? 
         AND is_deleted = 0`,
        [cutoffDate.toISOString()]
    );
    
    console.log('Limpeza LGPD executada');
}

// Executar limpeza semanal
setInterval(cleanExpiredData, 7 * 24 * 60 * 60 * 1000);

// 7. Middleware de timeout de sessão
app.use((req, res, next) => {
    req.sessionTimeout = setTimeout(() => {
        if (req.user) {
            console.log(`Sessão expirada para usuário ${req.user.id}`);
            // Aqui você pode invalidar o token se necessário
        }
    }, 30 * 60 * 1000); // 30 minutos
    
    next();
});

// Servir arquivos estáticos
app.use(express.static('public'));

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`JWT Secret: ${JWT_SECRET}`);
});
// Configurações de segurança avançadas
const securityConfig = {
    // Criptografia
    encryption: {
        algorithm: 'aes-256-gcm',
        keyDerivation: {
            iterations: 100000,
            keyLength: 32,
            digest: 'sha512'
        }
    },
    
    // Autenticação
    auth: {
        jwtExpiration: '8h',
        refreshTokenExpiration: '7d',
        maxLoginAttempts: 3,
        lockoutTime: 900000, // 15 minutos
        passwordPolicy: {
            minLength: 8,
            requireUppercase: true,
            requireLowercase: true,
            requireNumbers: true,
            requireSpecialChars: true
        }
    },
    
    // LGPD
    lgpd: {
        dataRetentionYears: 5,
        autoAnonymization: true,
        consentRequired: true,
        rightToBeForgotten: true
    },
    
    // Auditoria
    audit: {
        logAllOperations: true,
        retentionDays: 365,
        alertOnSuspicious: true
    },
    
    // Backup
    backup: {
        frequency: 'daily',
        retentionCount: 30,
        encryption: true,
        offsiteStorage: false
    }
};

module.exports = securityConfig;
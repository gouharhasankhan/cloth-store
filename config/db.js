// config/db.js - MySQL Database Connection (Railway Compatible)
const mysql = require('mysql2');
require('dotenv').config();

let db;

async function setupDatabase() {
  try {
    const dbConfig = {
      host: process.env.DB_HOST || process.env.MYSQLHOST,
      port: parseInt(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
      user: process.env.DB_USER || process.env.MYSQLUSER,
      password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD,
      database: process.env.DB_NAME || process.env.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 30000,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    };

    if (process.env.NODE_ENV !== 'production') {
      const tempPool = mysql.createPool({
        host: dbConfig.host, port: dbConfig.port,
        user: dbConfig.user, password: dbConfig.password,
        waitForConnections: true, connectionLimit: 5, connectTimeout: 30000,
        ssl: dbConfig.ssl
      });
      await tempPool.promise().query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
      console.log(`✅ Database '${dbConfig.database}' ready!`);
      tempPool.end();
    }

    const pool = mysql.createPool(dbConfig);
    db = pool.promise();

    // ── TABLES ──
    await db.query(`CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(150) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      phone VARCHAR(15),
      address TEXT,
      role ENUM('user','admin') DEFAULT 'user',
      is_blocked BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await db.query(`CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      slug VARCHAR(100) UNIQUE NOT NULL,
      image VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await db.query(`CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      description TEXT,
      price DECIMAL(10,2) NOT NULL,
      discount_price DECIMAL(10,2),
      stock INT DEFAULT 0,
      category_id INT,
      image VARCHAR(255),
      sizes VARCHAR(100),
      colors VARCHAR(200),
      is_featured BOOLEAN DEFAULT FALSE,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    )`);

    await db.query(`CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      total_amount DECIMAL(10,2) NOT NULL,
      status ENUM('pending','processing','shipped','delivered','cancelled') DEFAULT 'pending',
      payment_method VARCHAR(50) DEFAULT 'COD',
      payment_status ENUM('pending','paid','failed') DEFAULT 'pending',
      razorpay_order_id VARCHAR(100),
      razorpay_payment_id VARCHAR(100),
      shipping_address TEXT NOT NULL,
      coupon_code VARCHAR(50),
      discount_amount DECIMAL(10,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    await db.query(`CREATE TABLE IF NOT EXISTS order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity INT NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      size VARCHAR(10),
      color VARCHAR(50),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    await db.query(`CREATE TABLE IF NOT EXISTS cart (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity INT DEFAULT 1,
      size VARCHAR(10),
      color VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )`);

    await db.query(`CREATE TABLE IF NOT EXISTS reviews (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      product_id INT NOT NULL,
      rating INT CHECK (rating BETWEEN 1 AND 5),
      comment TEXT,
      is_approved BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    await db.query(`CREATE TABLE IF NOT EXISTS coupons (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(50) UNIQUE NOT NULL,
      type ENUM('percent','fixed') DEFAULT 'percent',
      value DECIMAL(10,2) NOT NULL,
      min_order DECIMAL(10,2) DEFAULT 0,
      max_uses INT DEFAULT NULL,
      used_count INT DEFAULT 0,
      once_per_user BOOLEAN DEFAULT TRUE,
      expires_at DATE DEFAULT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await db.query(`CREATE TABLE IF NOT EXISTS coupon_uses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      coupon_id INT NOT NULL,
      user_id INT NOT NULL,
      order_id INT,
      used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (coupon_id) REFERENCES coupons(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    await db.query(`CREATE TABLE IF NOT EXISTS settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      key_name VARCHAR(100) UNIQUE NOT NULL,
      value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);

    // Default settings insert
    const defaultSettings = [
      ['delivery_charge', '50'],
      ['free_delivery_above', '500'],
      ['cod_enabled', '1'],
      ['razorpay_enabled', '1'],
      ['min_order_amount', '0'],
      ['max_items_per_order', '20'],
      ['low_stock_threshold', '5'],
      ['hide_out_of_stock', '0'],
      ['allow_reviews', '1'],
      ['first_order_discount', '0'],
      ['first_order_discount_value', '10'],
      ['banner_enabled', '0'],
      ['banner_text', 'Special Sale — Free Delivery on orders above ₹500!'],
      ['banner_color', 'warning'],
      ['estimated_delivery_days', '3-5'],
      ['cod_cities', ''],
      ['site_name', 'FashionHub'],
      ['site_tagline', 'Your Style, Our Passion'],
      ['contact_phone', ''],
      ['contact_email', ''],
      ['contact_address', ''],
      ['maintenance_mode', '0'],
    ];

    for (const [key, value] of defaultSettings) {
      await db.query(
        `INSERT IGNORE INTO settings (key_name, value) VALUES (?, ?)`,
        [key, value]
      );
    }

    console.log('✅ Sab tables ready!');

    // Seed admin
    const [admins] = await db.query("SELECT id FROM users WHERE email = 'admin@fashionhub.com'");
    if (admins.length === 0) {
      await db.query(`INSERT INTO users (name,email,password,role) VALUES ('Admin','admin@fashionhub.com','$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh','admin')`);
      console.log('✅ Admin: admin@fashionhub.com / admin123');
    }

    const [cats] = await db.query("SELECT id FROM categories LIMIT 1");
    if (cats.length === 0) {
      await db.query(`INSERT INTO categories (name,slug) VALUES ('Men','men'),('Women','women'),('Kids','kids'),('Ethnic Wear','ethnic-wear'),('Western Wear','western-wear')`);
      await db.query(`INSERT INTO products (name,description,price,discount_price,stock,category_id,sizes,colors,is_featured) VALUES
        ('Classic Cotton Kurta','Premium quality cotton kurta for men.',899.00,699.00,50,4,'S,M,L,XL,XXL','White,Blue,Green',1),
        ('Anarkali Suit Set','Beautiful Anarkali suit with dupatta.',1599.00,1199.00,30,2,'S,M,L,XL','Red,Pink,Yellow',1),
        ('Slim Fit Jeans','Trendy slim fit jeans for men.',1299.00,999.00,100,1,'28,30,32,34,36','Blue,Black,Grey',1),
        ('Floral Printed Kurti','Stylish kurti for women.',699.00,499.00,75,2,'S,M,L,XL','Pink,Orange,Purple',1),
        ('Kids Cotton T-Shirt','Soft t-shirt for kids.',299.00,199.00,150,3,'S,M,L','Red,Blue,Green',0),
        ('Lehenga Choli Set','Designer lehenga with embroidery.',3999.00,2999.00,20,4,'S,M,L,XL','Red,Maroon,Royal Blue',1)`);
      console.log('✅ Sample data ready!');
    }

    console.log('🚀 Database setup complete!');
  } catch (err) {
    console.error('❌ Database setup failed:', err.message);
    process.exit(1);
  }
}

setupDatabase();

// Helper: ek setting fetch karo
async function getSetting(key) {
  if (!db) return null;
  const [rows] = await db.query('SELECT value FROM settings WHERE key_name = ?', [key]);
  return rows.length > 0 ? rows[0].value : null;
}

// Helper: saari settings object ke roop mein
async function getAllSettings() {
  if (!db) return {};
  const [rows] = await db.query('SELECT key_name, value FROM settings');
  const obj = {};
  rows.forEach(r => obj[r.key_name] = r.value);
  return obj;
}

module.exports = new Proxy({}, {
  get(_, prop) {
    if (prop === 'getSetting') return getSetting;
    if (prop === 'getAllSettings') return getAllSettings;
    if (!db) throw new Error('Database abhi ready nahi hai');
    return db[prop].bind(db);
  }
});

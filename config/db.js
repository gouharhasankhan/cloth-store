// config/db.js - MySQL Database Connection (Railway Compatible)
const mysql = require('mysql2');
require('dotenv').config();

let db;

async function setupDatabase() {
  try {
    // Railway provides DATABASE_URL or individual env vars
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

    // Pehle bina database ke connect karein (Railway pe DB already exist karta hai)
    const tempPool = mysql.createPool({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      waitForConnections: true,
      connectionLimit: 5,
      connectTimeout: 30000,
      ssl: dbConfig.ssl
    });
    const tempDb = tempPool.promise();

    // Database create karein agar local dev hai
    if (process.env.NODE_ENV !== 'production') {
      await tempDb.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
      console.log(`✅ Database '${dbConfig.database}' ready!`);
    }
    tempPool.end();

    // Ab full pool banao database ke saath
    const pool = mysql.createPool(dbConfig);
    db = pool.promise();

    // Tables create karein
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        phone VARCHAR(15),
        address TEXT,
        role ENUM('user', 'admin') DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        image VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS products (
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        status ENUM('pending','processing','shipped','delivered','cancelled') DEFAULT 'pending',
        payment_method VARCHAR(50) DEFAULT 'COD',
        payment_status ENUM('pending','paid','failed') DEFAULT 'pending',
        razorpay_order_id VARCHAR(100),
        razorpay_payment_id VARCHAR(100),
        shipping_address TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        size VARCHAR(10),
        color VARCHAR(50),
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS cart (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT DEFAULT 1,
        size VARCHAR(10),
        color VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        product_id INT NOT NULL,
        rating INT CHECK (rating BETWEEN 1 AND 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);

    console.log('✅ Sab tables ready!');

    // Admin user seeddata
    const [admins] = await db.query("SELECT id FROM users WHERE email = 'admin@fashionhub.com'");
    if (admins.length === 0) {
      await db.query(`
        INSERT INTO users (name, email, password, role) VALUES 
        ('Admin', 'admin@fashionhub.com', '$2a$10$QiKmAySXQm5uDYUecU0/pev2Rhf8qlyuQQgwRWJDeoLHP3SrCTTR.', 'admin')
      `);
      console.log('✅ Admin user create ho gaya! (admin@fashionhub.com / admin123)');
    }

    const [cats] = await db.query("SELECT id FROM categories LIMIT 1");
    if (cats.length === 0) {
      await db.query(`
        INSERT INTO categories (name, slug) VALUES
        ('Men', 'men'), ('Women', 'women'), ('Kids', 'kids'),
        ('Ethnic Wear', 'ethnic-wear'), ('Western Wear', 'western-wear')
      `);
      await db.query(`
        INSERT INTO products (name, description, price, discount_price, stock, category_id, sizes, colors, is_featured) VALUES
        ('Classic Cotton Kurta', 'Premium quality cotton kurta for men.', 899.00, 699.00, 50, 4, 'S,M,L,XL,XXL', 'White,Blue,Green', 1),
        ('Anarkali Suit Set', 'Beautiful Anarkali suit with dupatta.', 1599.00, 1199.00, 30, 2, 'S,M,L,XL', 'Red,Pink,Yellow', 1),
        ('Slim Fit Jeans', 'Trendy slim fit jeans for men.', 1299.00, 999.00, 100, 1, '28,30,32,34,36', 'Blue,Black,Grey', 1),
        ('Floral Printed Kurti', 'Stylish kurti for women.', 699.00, 499.00, 75, 2, 'S,M,L,XL', 'Pink,Orange,Purple', 1),
        ('Kids Cotton T-Shirt', 'Soft t-shirt for kids.', 299.00, 199.00, 150, 3, 'S,M,L', 'Red,Blue,Green', 0),
        ('Lehenga Choli Set', 'Designer lehenga with embroidery.', 3999.00, 2999.00, 20, 4, 'S,M,L,XL', 'Red,Maroon,Royal Blue', 1)
      `);
      console.log('✅ Sample data add ho gaya!');
    }

    console.log('🚀 Database setup complete!');

  } catch (err) {
    console.error('❌ Database setup failed:', err.message);
    console.error('Full error:', err);
    process.exit(1);
  }
}

setupDatabase();

module.exports = new Proxy({}, {
  get(_, prop) {
    if (!db) throw new Error('Database abhi ready nahi hai');
    return db[prop].bind(db);
  }
});

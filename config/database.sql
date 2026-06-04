-- ============================================
-- CLOTH STORE - MySQL Database Schema
-- ============================================

CREATE DATABASE IF NOT EXISTS cloth_store;
USE cloth_store;

-- Users Table (Customers + Admin)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(15),
  address TEXT,
  role ENUM('user', 'admin') DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  image VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products Table
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  discount_price DECIMAL(10,2),
  stock INT DEFAULT 0,
  category_id INT,
  image VARCHAR(255),
  sizes VARCHAR(100) COMMENT 'e.g. S,M,L,XL,XXL',
  colors VARCHAR(200) COMMENT 'e.g. Red,Blue,Black',
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
  payment_method VARCHAR(50) DEFAULT 'COD',
  shipping_address TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Order Items Table
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
);

-- Cart Table
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
);

-- Reviews Table
CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  product_id INT NOT NULL,
  rating INT CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ============================================
-- SAMPLE DATA
-- ============================================

-- Admin user (password: admin123)
INSERT INTO users (name, email, password, role) VALUES 
('Admin', 'admin@fashionhub.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh', 'admin');

-- Categories
INSERT INTO categories (name, slug) VALUES
('Men', 'men'),
('Women', 'women'),
('Kids', 'kids'),
('Ethnic Wear', 'ethnic-wear'),
('Western Wear', 'western-wear');

-- Sample Products
INSERT INTO products (name, description, price, discount_price, stock, category_id, sizes, colors, is_featured) VALUES
('Classic Cotton Kurta', 'Premium quality cotton kurta for men, perfect for casual and festive occasions.', 899.00, 699.00, 50, 4, 'S,M,L,XL,XXL', 'White,Blue,Green', TRUE),
('Anarkali Suit Set', 'Beautiful Anarkali suit with dupatta, ideal for festive occasions.', 1599.00, 1199.00, 30, 2, 'S,M,L,XL', 'Red,Pink,Yellow', TRUE),
('Slim Fit Jeans', 'Trendy slim fit jeans for men, comfortable all-day wear.', 1299.00, 999.00, 100, 1, '28,30,32,34,36', 'Blue,Black,Grey', TRUE),
('Floral Printed Kurti', 'Stylish floral print kurti for women, perfect for summer.', 699.00, 499.00, 75, 2, 'S,M,L,XL', 'Pink,Orange,Purple', TRUE),
('Kids Cotton T-Shirt', 'Soft and comfortable cotton t-shirt for kids.', 299.00, 199.00, 150, 3, 'S,M,L', 'Red,Blue,Green,Yellow', FALSE),
('Lehenga Choli Set', 'Designer lehenga choli set with heavy embroidery work.', 3999.00, 2999.00, 20, 4, 'S,M,L,XL', 'Red,Maroon,Royal Blue', TRUE);

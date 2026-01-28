/**
 * Role-Based Access Control Utility
 * Handles user authentication and authorization
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const supabase = createClient(
  "https://sfknzqkiqxivzcualcau.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNma256cWtpcXhpdnpjdWFsY2F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3OTU0ODksImV4cCI6MjA3MjM3MTQ4OX0.JKjOS9NRdbVH1UanfqmBeHmMSnlWlZtDr-5LdKw5YaA"
);

// Page access configuration by role
const PAGE_ACCESS = {
  admin: [
    'admin-dashboard.html',
    'forecast.html',
    'verification-list.html',
    'shipment_tracker.html',
    'shipment-details.html',
    'product-details.html',
    'supplier-details.html',
    'supplier-shipment-responses.html',
    'bank-details.html',
    'clearing-agent-details.html',
    'warehouse-details.html',
    'logistic-cells.html',
    'send-freight-queries.html',
    'freight-query-response.html',
    'manage-freight-queries.html',
    'award-shipment.html',
    'documents.html',
    'admin-document-requirements.html',
    'bank-communication.html',
    'clearing-agent-communication.html',
    'supplier-payments.html',
    'admin-payment-terms.html',
    'costing-sheet-enhanced.html',
    'shipment-documents.html',
    'shipment.html'
  ],
  imports_ops: [
    'forecast.html'
  ]
};

// Menu items configuration by role
const MENU_CONFIG = {
  admin: 'all', // Admin sees all menu items
  imports_ops: [
    'forecast.html'
  ]
};

/**
 * Check if user is authenticated and get their role
 * @returns {Promise<{user: Object, role: string} | null>}
 */
export async function checkAuth() {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return null;
    }

    // Fetch user role from app_user table
    const { data: userData, error: userError } = await supabase
      .from('app_user')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      console.error('Error fetching user role:', userError);
      return null;
    }

    return {
      user,
      role: userData.role
    };
  } catch (error) {
    console.error('Auth check error:', error);
    return null;
  }
}

/**
 * Check if a user has access to a specific page
 * @param {string} role - User role
 * @param {string} pageName - Page filename
 * @returns {boolean}
 */
export function hasPageAccess(role, pageName) {
  if (role === 'admin') {
    return true; // Admin has access to all pages
  }

  const allowedPages = PAGE_ACCESS[role] || [];
  return allowedPages.includes(pageName);
}

/**
 * Get current page name from URL
 * @returns {string}
 */
export function getCurrentPage() {
  const path = window.location.pathname;
  return path.substring(path.lastIndexOf('/') + 1) || 'index.html';
}

/**
 * Redirect to login page
 */
export function redirectToLogin() {
  window.location.href = 'login.html';
}

/**
 * Redirect to unauthorized page or default page for role
 */
export function redirectToUnauthorized(role) {
  if (role === 'imports_ops') {
    window.location.href = 'forecast.html';
  } else {
    window.location.href = 'admin-dashboard.html';
  }
}

/**
 * Check page access and redirect if unauthorized
 * Call this at the start of every protected page
 */
export async function enforcePageAccess() {
  const authData = await checkAuth();
  
  if (!authData) {
    redirectToLogin();
    return null;
  }

  const currentPage = getCurrentPage();
  
  // Skip check for login page
  if (currentPage === 'login.html') {
    return authData;
  }

  if (!hasPageAccess(authData.role, currentPage)) {
    redirectToUnauthorized(authData.role);
    return null;
  }

  return authData;
}

/**
 * Check if user should see a menu item
 * @param {string} role - User role
 * @param {string} pageName - Page filename
 * @returns {boolean}
 */
export function shouldShowMenuItem(role, pageName) {
  if (role === 'admin') {
    return true; // Admin sees all menu items
  }

  const allowedPages = MENU_CONFIG[role] || [];
  return allowedPages.includes(pageName);
}

/**
 * Filter sidebar menu items based on user role
 * Call this after page load to hide unauthorized menu items
 * @param {string} role - User role
 */
export function filterSidebarByRole(role) {
  if (role === 'admin') {
    return; // Admin sees everything
  }

  const sidebar = document.querySelector('.sidebar-nav');
  if (!sidebar) return;

  const navLinks = sidebar.querySelectorAll('.nav-link');
  
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (!href || href === '#') return;

    // Extract page name from href
    const pageName = href.split('/').pop().split('?')[0];
    
    if (!shouldShowMenuItem(role, pageName)) {
      // Hide the parent li element
      const parentLi = link.closest('li');
      if (parentLi) {
        parentLi.style.display = 'none';
      }
    }
  });

  // Hide empty submenus
  const submenus = sidebar.querySelectorAll('.submenu');
  submenus.forEach(submenu => {
    const visibleItems = Array.from(submenu.querySelectorAll('li')).filter(
      li => li.style.display !== 'none'
    );
    
    if (visibleItems.length === 0) {
      // Hide parent menu item if all submenu items are hidden
      const parentLi = submenu.closest('li').previousElementSibling;
      if (parentLi) {
        parentLi.closest('li').style.display = 'none';
      }
    }
  });
}

/**
 * Logout function
 * Signs out user and redirects to login page
 */
export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Logout error:', error);
    throw error;
  }
  window.location.href = 'login.html';
}

export { supabase };

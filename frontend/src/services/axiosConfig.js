import axios from 'axios';

// Get the API URL from environment variables
const API_URL = process.env.REACT_APP_API_URL;

// Configure axios defaults
axios.defaults.baseURL = API_URL;

// Load token from localStorage and set it in axios headers
const token = localStorage.getItem('token');
if (token) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

// Export configured axios instance
export default axios;
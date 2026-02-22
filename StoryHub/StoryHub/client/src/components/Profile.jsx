import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  FiUser,
  FiSettings,
  FiBook,
  FiLogOut,
  FiHelpCircle,
  FiStar,
  FiMessageSquare
} from 'react-icons/fi'

const Profile = () => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)
  const navigate = useNavigate()

  // Mock user data
  const user = {
    name: 'John Developer',
    username: '@johndev',
    email: 'john@example.com',
    role: 'author',
    posts: 12,
    followers: 245,
    following: 189
  }


  const handleLogout = ()=>{
        navigate("/login")
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Profile Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-full overflow-hidden border-2 border-transparent hover:border-blue-500 transition-colors"
      >
        <img
          src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop"
          alt="Profile"
          className="w-full h-full object-cover"
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50">
          {/* Profile Header */}
          <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-100">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-full border-4 border-white overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop"
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-900">{user.name}</h3>
                <p className="text-gray-600 text-sm">{user.username}</p>
                <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium ${
                  user.role === 'admin' ? 'bg-red-100 text-red-800' :
                  user.role === 'author' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {user.role}
                </span>
              </div>
            </div>

            {/* User Stats */}
            <div className="grid grid-cols-3 gap-4 mt-6 text-center">
              <div>
                <div className="font-bold text-lg">{user.posts}</div>
                <div className="text-sm text-gray-600">Posts</div>
              </div>
              <div>
                <div className="font-bold text-lg">{user.followers}</div>
                <div className="text-sm text-gray-600">Followers</div>
              </div>
              <div>
                <div className="font-bold text-lg">{user.following}</div>
                <div className="text-sm text-gray-600">Following</div>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            <Link
              to="/profile"
              className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-50"
              onClick={() => setIsOpen(false)}
            >
              <FiUser className="w-5 h-5 mr-3 text-gray-500" />
              <span>My Profile</span>
            </Link>

            <Link
              to="/profile/posts"
              className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-50"
              onClick={() => setIsOpen(false)}
            >
              <FiBook className="w-5 h-5 mr-3 text-gray-500" />
              <span>My Posts</span>
            </Link>

           


            <div className="border-t border-gray-100 my-2"></div>

            
         

            <button
              className="flex items-center w-full px-6 py-3 text-red-600 hover:bg-red-50"
              onClick={handleLogout}
            >
              <FiLogOut className="w-5 h-5 mr-3" />
              <span>Logout</span>
            </button>
          </div>

       
        </div>
      )}
    </div>
  )
}

export default Profile
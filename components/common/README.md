# OnecallLoginSidebar Component

## Description
A reusable React component that provides a floating settings button and a right-side sidebar for Onecall login functionality. The component features a gear icon button that opens a sliding sidebar with username and password input fields, includes API authentication, and displays detailed response information.

## Features
- **Floating Settings Button**: Always visible gear icon in the bottom-right corner
- **Sliding Sidebar**: Smooth slide-in animation from the right side
- **Login Form**: Username and password input fields with validation
- **API Authentication**: Built-in authentication using Onecall API
- **Response Display**: Shows detailed API response including success/failure status
- **Loading States**: Visual feedback during authentication process
- **Auto-close**: Sidebar automatically closes after successful login
- **Responsive Design**: Works on desktop and mobile devices
- **Customizable**: Optional `onLogin` callback for custom login handling
- **Accessibility**: Proper focus management and keyboard navigation

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onLogin` | `(username: string, password: string) => void` | `undefined` | Callback function called after successful API authentication |
| `className` | `string` | `""` | Additional CSS classes for the floating button |

## API Integration

The component automatically handles authentication with the Onecall API:

### API Endpoint
```
POST /onecall/orktrack/rest/user/login?version=orktrack&accesspolicy=all&licenseinfo=true
```

### Authentication Method
- Uses Basic Authentication with Base64 encoded credentials
- Sends Authorization header: `Basic {base64(username:password)}`
- Handles CORS issues through proxy configuration

### Response Handling
- **Success**: Extracts access token from response
- **Failure**: Displays detailed error information
- **Debug Info**: Shows request/response details for troubleshooting

### Response Display
The sidebar shows:
- Success/Failure status with appropriate icons
- HTTP response code
- Access token (truncated for security)
- Error messages (if any)
- Full JSON response (toggleable)
- Debug information for development

## Usage Examples

### Basic Usage (with built-in API authentication)
```tsx
import OnecallLoginSidebar from '@/components/common/OnecallLoginSidebar';

function MyPage() {
  return (
    <div>
      {/* Your page content */}
      <OnecallLoginSidebar />
    </div>
  );
}
```

### With Custom Success Handler
```tsx
import OnecallLoginSidebar from '@/components/common/OnecallLoginSidebar';

function MyPage() {
  const handleLogin = (username: string, password: string) => {
    // This is called after successful API authentication
    console.log('User logged in:', username);
    // Store token, update state, redirect, etc.
  };

  return (
    <div>
      {/* Your page content */}
      <OnecallLoginSidebar onLogin={handleLogin} />
    </div>
  );
}
```

### With Custom Button Styling
```tsx
import OnecallLoginSidebar from '@/components/common/OnecallLoginSidebar';

function MyPage() {
  return (
    <div>
      {/* Your page content */}
      <OnecallLoginSidebar 
        className="bg-green-600 hover:bg-green-700" 
        onLogin={(username, password) => {
          console.log('Custom login:', username);
        }}
      />
    </div>
  );
}
```

## Implementation Details

### File Structure
```
components/
└── common/
    ├── OnecallLoginSidebar.tsx
    └── README.md
```

### Dependencies
- React (useState hook)
- Lucide React icons (`Settings`, `X`)

### State Management
The component manages the following internal state:
- `sidebarOpen`: Controls sidebar visibility
- `username`: Input field value for username
- `password`: Input field value for password

### Styling
- Uses Tailwind CSS classes
- Responsive design with mobile-first approach
- Smooth transitions and hover effects
- Consistent with existing design system

## Integration

### Pages Using This Component
- `pages/CallsDashboard.tsx`
- `pages/CallHistoryPage.tsx`
- `pages/CallDetailsPage.tsx`

### Import Path
```tsx
import OnecallLoginSidebar from '@/components/common/OnecallLoginSidebar';
```

## Browser Support
- Chrome 60+
- Firefox 60+
- Safari 12+
- Edge 79+

## Notes
- The component automatically handles API authentication with Onecall
- Form fields are cleared after successful login
- Sidebar auto-closes 2 seconds after successful authentication
- Form validation ensures both username and password are filled before submission
- Response display includes detailed debugging information
- Loading states provide visual feedback during API calls
- Error handling displays meaningful error messages to users
- The sidebar closes when clicking the backdrop
- Debug information is available for troubleshooting API issues

## Security Considerations
- Credentials are sent using Basic Authentication over HTTPS
- Tokens are truncated in the display for security
- Passwords are masked in console logs
- API responses are handled securely with proper error boundaries

## Future Enhancements
- Implement remember me functionality
- Add password visibility toggle
- Support for multiple authentication methods
- Integration with context/state management for global auth state
- Token refresh mechanism
- Session management
- Two-factor authentication support
- Rate limiting for API calls
- Offline authentication fallback
- Biometric authentication options
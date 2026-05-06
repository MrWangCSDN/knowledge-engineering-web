import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { LoginForm } from './LoginForm'

/**
 * Vitest smoke test：验证测试框架本身能跑 + LoginForm 能渲染。
 *
 * - BrowserRouter 包裹：因为 LoginForm 用了 useNavigate / useSearchParams
 * - 通过 label 文本找输入框（getByLabelText 走 htmlFor 关联）
 */
describe('LoginForm', () => {
  it('renders username and password inputs', () => {
    render(
      <BrowserRouter>
        <LoginForm />
      </BrowserRouter>,
    )
    expect(screen.getByLabelText(/邮箱.*用户名/)).toBeInTheDocument()
    // 用 selector: 'input' 排除 button[aria-label="显示密码"]，只匹配 input
    expect(screen.getByLabelText(/^密码$/, { selector: 'input' })).toBeInTheDocument()
  })
})

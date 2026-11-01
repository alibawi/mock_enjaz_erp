import { createRouterShim } from '../../shell/routerShim'

export * from 'react-router-dom'

export const ASSETS_BASE = '/fixed-assets'
export const { Link, NavLink, Navigate, useNavigate, useLocation } = createRouterShim(ASSETS_BASE)

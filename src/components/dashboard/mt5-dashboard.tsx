'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Wifi, WifiOff, Bot, Settings, RefreshCw, Loader2,
  TrendingUp, Shield, AlertTriangle,
  Circle, Clock, Hash, Building2, Wallet,
  X, Check, BarChart3,
  Activity, DollarSign, Trophy, ArrowDownRight, ArrowUpRight,
  Target, Zap, Timer, Coins, Percent,
  Lock, Eye, EyeOff, Server, Link2, Flame,
  Gauge, Save, Info, ArrowDown, ArrowUp,
} from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

// ===================== Types =====================

interface MT5Config {
  id: string;
  auto_trading_enabled: boolean;
  max_lot_size: number;
  risk_per_trade_pct: number;
  allowed_symbols: string[];
  max_open_positions: number;
  min_confidence: number;
  strategy_filter: string[];
  stop_loss_default_pips: number;
  take_profit_default_pips: number;
  trading_hours_start: string;
  trading_hours_end: string;
  updated_at: string | null;

  // Broker connection fields
  mt5_login?: number | null;
  mt5_password?: string | null;
  mt5_server?: string | null;
  mt5_account_type?: 'demo' | 'live' | null;
  mt5_connected?: boolean;

  // Risk management fields
  profit_target?: number | null;
  loss_limit?: number | null;
  lot_type?: 'fixed' | 'percentage' | null;
  lot_percentage?: number | null;
  fixed_lot?: number | null;
  daily_pnl?: number | null;
  daily_pnl_date?: string | null;
}

interface MT5Status {
  botStatus: 'online' | 'offline' | 'error' | 'connecting';
  lastHeartbeat: string | null;
  mt5Account: string | null;
  mt5Broker: string | null;
  mt5Balance: number | null;
  mt5Equity: number | null;
  mt5Leverage: number | null;
  mt5Currency: string | null;
  isActive: boolean;
  botVersion: string | null;
  openPositions: number;
  // New fields from backend status
  mt5_connected?: boolean;
  mt5_login?: number | null;
  mt5_server?: string | null;
  mt5_account_type?: 'demo' | 'live' | null;
  isStale?: boolean;
  lastHeartbeatAge?: number | null;
}

interface MT5Position {
  id: string;
  signalId: string | null;
  mt5Ticket: number;
  pair: string;
  direction: string;
  lotSize: number;
  openPrice: number;
  currentPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  profit: number | null;
  profitPips: number | null;
  swap: number | null;
  openTime: string;
}

interface MT5Signal {
  id: string;
  pair: string;
  direction: string;
  entry: string;
  stopLoss: string;
  takeProfit: string;
  probability: number;
  strategy: string;
  timeframe: string;
  status: string; // pending, executed, skipped, expired, failed
  source: string;
  mt5Ticket: number | null;
  executedAt: string | null;
  executionPrice: string | null;
  executionLot: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}



// ===================== Helpers =====================

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function formatPrice(value: number | null | undefined, decimals = 5): string {
  if (value == null) return '—';
  return value.toFixed(decimals);
}

function formatMoney(value: number | null | undefined): string {
  if (value == null) return '—';
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ===================== Sub-components =====================

/** Status dot indicator */
function StatusDot({ status }: { status: string }) {
  const color =
    status === 'online' ? 'bg-emerald-400' :
    status === 'error' ? 'bg-red-400' :
    status === 'connecting' ? 'bg-amber-400' :
    'bg-gray-500';

  const glow =
    status === 'online' ? 'shadow-[0_0_8px_rgba(52,211,153,0.5)]' :
    status === 'error' ? 'shadow-[0_0_8px_rgba(248,113,113,0.5)]' :
    '';

  return <Circle className={`w-2.5 h-2.5 ${color} ${glow} fill-current`} />;
}

/** Signal status badge */
function SignalStatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    executed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    skipped: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    expired: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  const variant = variants[status] || variants.skipped;
  const label = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <Badge className={`${variant} text-[9px] px-1.5 py-0 border`}>
      {label}
    </Badge>
  );
}

/** Loading skeleton for tab content */
function TabSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-4 w-20 bg-muted/50" />
          <Skeleton className="h-4 flex-1 bg-muted/50" />
        </div>
      ))}
    </div>
  );
}

/** Stat card for the Statistics tab */
function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  color = 'text-cyan-400',
  bgColor = 'bg-cyan-500/10',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subValue?: string;
  color?: string;
  bgColor?: string;
}) {
  return (
    <Card className="bg-card/80 border-border/40">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-lg ${bgColor} flex items-center justify-center shrink-0`}>
            <Icon className={`w-4 h-4 ${color}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
            <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
            {subValue && <p className="text-[10px] text-muted-foreground mt-0.5">{subValue}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


// ===================== Tab 1: Status & Connection =====================

function StatusTab({
  status,
  positions,
  onRefresh,
  loading,
  lastUpdated,
}: {
  status: MT5Status;
  positions: MT5Position[];
  onRefresh: () => void;
  loading: boolean;
  lastUpdated: Date | null;
}) {
  const statusLabel =
    status.botStatus === 'online' ? 'Online' :
    status.botStatus === 'error' ? 'Error' :
    status.botStatus === 'connecting' ? 'Connecting' :
    'Offline';

  const StatusIcon = status.botStatus === 'online' ? Wifi :
    status.botStatus === 'error' ? AlertTriangle : WifiOff;

  return (
    <div className="space-y-4">
      {/* Bot Connection Status */}
      <Card className="bg-card/80 border-border/40">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Bot className="w-4 h-4 text-cyan-400" />
              Bot Connection
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
              className="h-7 w-7 p-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status indicator */}
          <div className="flex items-center justify-between bg-secondary/30 rounded-lg p-3 border border-border/20">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                status.botStatus === 'online'
                  ? 'bg-emerald-500/20 shadow-[0_0_12px_rgba(52,211,153,0.3)]'
                  : status.botStatus === 'error'
                    ? 'bg-red-500/20 shadow-[0_0_12px_rgba(248,113,113,0.3)]'
                    : 'bg-secondary/50'
              }`}>
                <StatusIcon className={`w-5 h-5 ${
                  status.botStatus === 'online' ? 'text-emerald-400' :
                  status.botStatus === 'error' ? 'text-red-400' :
                  'text-muted-foreground'
                }`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <StatusDot status={status.botStatus} />
                  <span className="text-sm font-semibold">{statusLabel}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {status.botStatus === 'online'
                    ? 'Bot is connected and operational'
                    : status.botStatus === 'error'
                      ? 'Bot encountered an error'
                      : 'Bot is not connected'}
                </p>
              </div>
            </div>
            <Badge className={
              status.botStatus === 'online'
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] px-2'
                : status.botStatus === 'error'
                  ? 'bg-red-500/20 text-red-400 border-red-500/30 text-[9px] px-2'
                  : 'bg-gray-500/20 text-gray-400 border-gray-500/30 text-[9px] px-2'
            }>
              {statusLabel}
            </Badge>
          </div>

          {/* MT5 Terminal Status */}
          <div className="flex items-center justify-between bg-secondary/30 rounded-lg p-3 border border-border/20">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                status.botStatus === 'online' ? 'bg-cyan-500/20' : 'bg-secondary/50'
              }`}>
                <Activity className={`w-5 h-5 ${status.botStatus === 'online' ? 'text-cyan-400' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <span className="text-sm font-semibold">MT5 Terminal</span>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {status.botStatus === 'online' ? 'Terminal connected' : 'Terminal disconnected'}
                </p>
              </div>
            </div>
            <Badge className={
              status.botStatus === 'online'
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[9px] px-2'
                : 'bg-gray-500/20 text-gray-400 border-gray-500/30 text-[9px] px-2'
            }>
              {status.botStatus === 'online' ? 'CONNECTED' : 'DISCONNECTED'}
            </Badge>
          </div>

          {/* Account Info Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-secondary/30 rounded-lg p-3 border border-border/20">
              <div className="flex items-center gap-1.5 mb-1">
                <Wallet className="w-3 h-3 text-emerald-400" />
                <span className="text-[9px] text-muted-foreground uppercase">Balance</span>
              </div>
              <p className="text-sm font-bold tabular-nums text-emerald-400">
                {status.mt5Balance != null ? `$${formatMoney(status.mt5Balance)}` : '—'}
              </p>
            </div>
            <div className="bg-secondary/30 rounded-lg p-3 border border-border/20">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign className="w-3 h-3 text-cyan-400" />
                <span className="text-[9px] text-muted-foreground uppercase">Equity</span>
              </div>
              <p className="text-sm font-bold tabular-nums text-cyan-400">
                {status.mt5Equity != null ? `$${formatMoney(status.mt5Equity)}` : '—'}
              </p>
            </div>
            <div className="bg-secondary/30 rounded-lg p-3 border border-border/20">
              <div className="flex items-center gap-1.5 mb-1">
                <Percent className="w-3 h-3 text-amber-400" />
                <span className="text-[9px] text-muted-foreground uppercase">Leverage</span>
              </div>
              <p className="text-sm font-bold tabular-nums text-amber-400">
                {status.mt5Leverage != null ? `1:${status.mt5Leverage}` : '—'}
              </p>
            </div>
            <div className="bg-secondary/30 rounded-lg p-3 border border-border/20">
              <div className="flex items-center gap-1.5 mb-1">
                <Coins className="w-3 h-3 text-muted-foreground" />
                <span className="text-[9px] text-muted-foreground uppercase">Currency</span>
              </div>
              <p className="text-sm font-bold tabular-nums">
                {status.mt5Currency || '—'}
              </p>
            </div>
          </div>

          {/* Additional info row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-secondary/30 rounded-lg p-3 border border-border/20">
              <div className="flex items-center gap-1.5 mb-1">
                <Hash className="w-3 h-3 text-muted-foreground" />
                <span className="text-[9px] text-muted-foreground uppercase">Account</span>
              </div>
              <p className="text-sm font-semibold tabular-nums">
                {status.mt5Account || '—'}
              </p>
            </div>
            <div className="bg-secondary/30 rounded-lg p-3 border border-border/20">
              <div className="flex items-center gap-1.5 mb-1">
                <Building2 className="w-3 h-3 text-muted-foreground" />
                <span className="text-[9px] text-muted-foreground uppercase">Broker</span>
              </div>
              <p className="text-sm font-semibold truncate">
                {status.mt5Broker || '—'}
              </p>
            </div>
          </div>

          {/* Heartbeat, Version, Open Positions */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-secondary/30 rounded-lg p-3 border border-border/20 text-center">
              <Clock className="w-3.5 h-3.5 text-muted-foreground mx-auto mb-1" />
              <p className="text-[9px] text-muted-foreground uppercase">Heartbeat</p>
              <p className="text-[11px] font-semibold tabular-nums mt-0.5">
                {formatRelativeTime(status.lastHeartbeat)}
              </p>
            </div>
            <div className="bg-secondary/30 rounded-lg p-3 border border-border/20 text-center">
              <Zap className="w-3.5 h-3.5 text-muted-foreground mx-auto mb-1" />
              <p className="text-[9px] text-muted-foreground uppercase">Version</p>
              <p className="text-[11px] font-semibold mt-0.5">
                {status.botVersion || '—'}
              </p>
            </div>
            <div className="bg-secondary/30 rounded-lg p-3 border border-border/20 text-center">
              <TrendingUp className="w-3.5 h-3.5 text-muted-foreground mx-auto mb-1" />
              <p className="text-[9px] text-muted-foreground uppercase">Positions</p>
              <p className="text-[11px] font-semibold tabular-nums mt-0.5">
                {positions.length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Refresh button + last updated */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">
            Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : '—'}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="h-7 text-[10px] border-border/40 gap-1.5"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
    </div>
  );
}


// ===================== Tab 2: Broker Connection (NEW) =====================

function BrokerConnectionTab({
  config,
  status,
  onSave,
  updating,
}: {
  config: MT5Config | null;
  status: MT5Status;
  onSave: (updates: Record<string, unknown>) => void;
  updating: boolean;
}) {
  const [mt5Login, setMt5Login] = useState<string>('');
  const [mt5Password, setMt5Password] = useState('');
  const [mt5Server, setMt5Server] = useState('');
  const [accountType, setAccountType] = useState<'demo' | 'live'>('demo');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);

  // Sync local state when config changes
  const [lastConfigId, setLastConfigId] = useState<string | null>(null);
  if (config && config.id !== lastConfigId) {
    setLastConfigId(config.id);
    setMt5Login(config.mt5_login != null ? String(config.mt5_login) : '');
    setMt5Password(''); // Never pre-fill password from API
    setPasswordChanged(false);
    setMt5Server(config.mt5_server || '');
    setAccountType(config.mt5_account_type || 'demo');
  }

  const isBrokerConnected = status.botStatus === 'online' && (status.mt5_connected ?? false);
  const hasCredentials = config?.mt5_login != null && config.mt5_login > 0 && config?.mt5_server;

  const handleSave = useCallback(() => {
    const updates: Record<string, unknown> = {};

    if (mt5Login) {
      updates.mt5_login = parseInt(mt5Login) || 0;
    }
    if (!passwordChanged) {
      // Don't include mt5_password at all when password hasn't changed
    } else if (mt5Password) {
      updates.mt5_password = mt5Password;
    }
    if (mt5Server) {
      updates.mt5_server = mt5Server;
    }
    updates.mt5_account_type = accountType;

    onSave(updates);
    toast.success('Broker credentials saved', {
      description: 'The bot will use these credentials to connect to your MT5 account.',
    });
    setPasswordChanged(false);
    setMt5Password('');
  }, [mt5Login, mt5Password, mt5Server, accountType, passwordChanged, onSave]);

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <Card className={`bg-card/80 border-border/40 transition-all duration-500 ${
        isBrokerConnected ? 'border-emerald-500/40 shadow-[0_0_20px_rgba(52,211,153,0.1)]' : ''
      }`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-500 ${
                isBrokerConnected
                  ? 'bg-emerald-500/20 shadow-[0_0_16px_rgba(52,211,153,0.3)]'
                  : hasCredentials
                    ? 'bg-amber-500/20'
                    : 'bg-secondary/50'
              }`}>
                {isBrokerConnected ? (
                  <Link2 className="w-6 h-6 text-emerald-400" />
                ) : hasCredentials ? (
                  <Link2 className="w-6 h-6 text-amber-400" />
                ) : (
                  <Link2 className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  Broker Connection
                  {isBrokerConnected && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] px-1.5 py-0 animate-pulse">
                      CONNECTED
                    </Badge>
                  )}
                  {!isBrokerConnected && hasCredentials && (
                    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[9px] px-1.5 py-0">
                      PENDING
                    </Badge>
                  )}
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  {isBrokerConnected
                    ? 'Broker is connected and trading is active'
                    : hasCredentials
                      ? 'Credentials saved — waiting for bot to connect'
                      : 'Enter your broker credentials to connect'}
                </p>
              </div>
            </div>
            <StatusDot status={isBrokerConnected ? 'online' : hasCredentials ? 'connecting' : 'offline'} />
          </div>
        </CardContent>
      </Card>

      {/* Broker Credentials Form */}
      <Card className="bg-card/80 border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Lock className="w-4 h-4 text-amber-400" />
            MT5 Broker Credentials
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* MT5 Login */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Hash className="w-3 h-3" />
              MT5 Login (Account Number)
            </Label>
            <Input
              type="number"
              placeholder="e.g., 12345678"
              value={mt5Login}
              onChange={(e) => setMt5Login(e.target.value)}
              className="h-9 text-xs tabular-nums"
            />
            <p className="text-[9px] text-muted-foreground">
              The account number provided by your broker
            </p>
          </div>

          {/* MT5 Password */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Lock className="w-3 h-3" />
              MT5 Password
            </Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder={hasCredentials ? 'Enter new password to change' : 'Enter your MT5 password'}
                value={mt5Password}
                onChange={(e) => {
                  setMt5Password(e.target.value);
                  setPasswordChanged(true);
                }}
                className="h-9 text-xs pr-10"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </Button>
            </div>
            {hasCredentials && !passwordChanged && (
              <p className="text-[9px] text-amber-400/70 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Password is saved. Leave blank to keep current password.
              </p>
            )}
          </div>

          {/* MT5 Server */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Server className="w-3 h-3" />
              MT5 Server
            </Label>
            <Input
              type="text"
              placeholder="e.g., MetaQuotes-Demo, ICMarketsSC-MT5"
              value={mt5Server}
              onChange={(e) => setMt5Server(e.target.value)}
              className="h-9 text-xs"
            />
            <p className="text-[9px] text-muted-foreground">
              The server name shown in your MT5 terminal login dialog
            </p>
          </div>

          {/* Account Type Toggle */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Account Type</Label>
            <div className="flex items-center gap-2 bg-secondary/30 rounded-lg p-1 border border-border/20">
              <button
                type="button"
                onClick={() => setAccountType('demo')}
                className={`flex-1 h-8 rounded-md text-[11px] font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 ${
                  accountType === 'demo'
                    ? 'bg-cyan-500/20 text-cyan-400 shadow-sm border border-cyan-500/30'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Shield className="w-3 h-3" />
                DEMO
              </button>
              <button
                type="button"
                onClick={() => setAccountType('live')}
                className={`flex-1 h-8 rounded-md text-[11px] font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 ${
                  accountType === 'live'
                    ? 'bg-amber-500/20 text-amber-400 shadow-sm border border-amber-500/30'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Flame className="w-3 h-3" />
                LIVE
              </button>
            </div>
            {accountType === 'live' && (
              <p className="text-[9px] text-amber-400/80 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                LIVE account — Real money is at risk. Use with caution.
              </p>
            )}
          </div>

          <Separator className="bg-border/30" />

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={updating || !mt5Login || !mt5Server}
            className="w-full h-9 text-xs bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white"
          >
            {updating ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5 mr-1.5" />
            )}
            Save Broker Credentials
          </Button>
        </CardContent>
      </Card>

      {/* Security Notice */}
      <Card className="bg-card/80 border-border/40">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-emerald-400">Security Notice</h4>
              <ul className="text-[9px] text-muted-foreground space-y-0.5 list-disc pl-3">
                <li>Your credentials are stored securely in an encrypted database</li>
                <li>Passwords are never displayed after saving</li>
                <li>Credentials are used only for the MT5 terminal connection</li>
                <li>The bot reads your credentials and connects to MT5 automatically</li>
                <li>You can change or clear credentials at any time</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


// ===================== Tab 3: Risk Management (NEW) =====================

function RiskManagementTab({
  config,
  status,
  onSave,
  updating,
}: {
  config: MT5Config | null;
  status: MT5Status;
  onSave: (updates: Record<string, unknown>) => void;
  updating: boolean;
}) {
  const [profitTarget, setProfitTarget] = useState(0);
  const [lossLimit, setLossLimit] = useState(0);
  const [lotType, setLotType] = useState<'fixed' | 'percentage'>('fixed');
  const [fixedLot, setFixedLot] = useState(0.01);
  const [lotPercentage, setLotPercentage] = useState(1);

  // Sync local state when config changes
  const [lastConfigId, setLastConfigId] = useState<string | null>(null);
  if (config && config.id !== lastConfigId) {
    setLastConfigId(config.id);
    setProfitTarget(config.profit_target ?? 0);
    setLossLimit(config.loss_limit ?? 0);
    setLotType(config.lot_type ?? 'fixed');
    setFixedLot(config.fixed_lot ?? 0.01);
    setLotPercentage(config.lot_percentage ?? 1);
  }

  // Daily P&L from config (updated by bot)
  const dailyPnl = config?.daily_pnl ?? 0;
  const dailyPnlDate = config?.daily_pnl_date ?? null;

  // Calculate progress toward targets
  const profitProgress = profitTarget > 0 ? Math.min(100, Math.max(0, (dailyPnl / profitTarget) * 100)) : 0;
  const lossProgress = lossLimit > 0 ? Math.min(100, Math.max(0, (Math.abs(Math.min(0, dailyPnl)) / lossLimit) * 100)) : 0;

  // Is daily limit hit?
  const profitTargetHit = profitTarget > 0 && dailyPnl >= profitTarget;
  const lossLimitHit = lossLimit > 0 && dailyPnl <= -lossLimit;

  const handleSave = useCallback(() => {
    onSave({
      profit_target: profitTarget,
      loss_limit: lossLimit,
      lot_type: lotType,
      fixed_lot: lotType === 'fixed' ? fixedLot : undefined,
      lot_percentage: lotType === 'percentage' ? lotPercentage : undefined,
    });
    toast.success('Risk management settings saved', {
      description: 'The bot will use these settings for risk management.',
    });
  }, [profitTarget, lossLimit, lotType, fixedLot, lotPercentage, onSave]);

  return (
    <div className="space-y-4">
      {/* Daily P&L Overview */}
      <Card className="bg-card/80 border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            Daily P&L
            {dailyPnlDate && (
              <span className="text-[9px] text-muted-foreground font-normal ml-1">
                ({new Date(dailyPnlDate).toLocaleDateString()})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current P&L Display */}
          <div className="flex items-center justify-center bg-secondary/30 rounded-lg p-4 border border-border/20">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase mb-1">Today&apos;s P&L</p>
              <p className={`text-2xl font-bold tabular-nums ${
                dailyPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {dailyPnl >= 0 ? '+' : ''}{dailyPnl.toFixed(2)}
              </p>
              <p className="text-[9px] text-muted-foreground mt-1">
                {status.mt5Currency || 'USD'}
              </p>
            </div>
          </div>

          {/* Profit Target Progress */}
          {profitTarget > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ArrowUp className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] text-muted-foreground">Meta de Ganho</span>
                  {profitTargetHit && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[8px] px-1 py-0">
                      REACHED
                    </Badge>
                  )}
                </div>
                <span className="text-[10px] tabular-nums text-emerald-400">
                  {dailyPnl.toFixed(2)} / {profitTarget.toFixed(2)}
                </span>
              </div>
              <div className="h-3 bg-secondary/50 rounded-full overflow-hidden">
                <div
                  className={`transition-all duration-700 rounded-full h-full ${
                    profitTargetHit ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-emerald-500/60'
                  }`}
                  style={{ width: `${profitProgress}%` }}
                />
              </div>
              <p className="text-[9px] text-muted-foreground text-right">
                {profitProgress.toFixed(1)}% of target
              </p>
            </div>
          )}

          {/* Loss Limit Progress */}
          {lossLimit > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ArrowDown className="w-3 h-3 text-red-400" />
                  <span className="text-[10px] text-muted-foreground">Meta de Perca</span>
                  {lossLimitHit && (
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[8px] px-1 py-0">
                      LIMIT HIT
                    </Badge>
                  )}
                </div>
                <span className="text-[10px] tabular-nums text-red-400">
                  {Math.abs(Math.min(0, dailyPnl)).toFixed(2)} / {lossLimit.toFixed(2)}
                </span>
              </div>
              <div className="h-3 bg-secondary/50 rounded-full overflow-hidden">
                <div
                  className={`transition-all duration-700 rounded-full h-full ${
                    lossLimitHit ? 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]' : 'bg-red-500/60'
                  }`}
                  style={{ width: `${lossProgress}%` }}
                />
              </div>
              <p className="text-[9px] text-muted-foreground text-right">
                {lossProgress.toFixed(1)}% of limit
              </p>
            </div>
          )}

          {profitTarget === 0 && lossLimit === 0 && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
              <p className="text-[10px] text-amber-400/80 flex items-center gap-1.5">
                <Info className="w-3 h-3" />
                Set a profit target or loss limit below to enable daily risk management.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profit Target / Loss Limit Configuration */}
      <Card className="bg-card/80 border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Target className="w-4 h-4 text-amber-400" />
            Daily Limits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Meta de Ganho (Profit Target) */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              Meta de Ganho (Profit Target)
            </Label>
            <Input
              type="number"
              min={0}
              step={10}
              placeholder="0 = disabled"
              value={profitTarget || ''}
              onChange={(e) => setProfitTarget(parseFloat(e.target.value) || 0)}
              className="h-9 text-xs tabular-nums"
            />
            <p className="text-[9px] text-muted-foreground">
              Daily profit target in {status.mt5Currency || 'USD'}. When reached, bot stops trading for the day. Set 0 to disable.
            </p>
          </div>

          {/* Meta de Perca (Loss Limit) */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 text-red-400" />
              Meta de Perca (Loss Limit)
            </Label>
            <Input
              type="number"
              min={0}
              step={10}
              placeholder="0 = disabled"
              value={lossLimit || ''}
              onChange={(e) => setLossLimit(parseFloat(e.target.value) || 0)}
              className="h-9 text-xs tabular-nums"
            />
            <p className="text-[9px] text-muted-foreground">
              Maximum daily loss in {status.mt5Currency || 'USD'}. When reached, bot stops trading for the day. Set 0 to disable.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Lot Sizing Configuration */}
      <Card className="bg-card/80 border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Gauge className="w-4 h-4 text-cyan-400" />
            Tipo de Lote (Lot Sizing)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Lot Type Toggle */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Lot Sizing Method</Label>
            <div className="flex items-center gap-2 bg-secondary/30 rounded-lg p-1 border border-border/20">
              <button
                type="button"
                onClick={() => setLotType('fixed')}
                className={`flex-1 h-8 rounded-md text-[11px] font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 ${
                  lotType === 'fixed'
                    ? 'bg-cyan-500/20 text-cyan-400 shadow-sm border border-cyan-500/30'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Hash className="w-3 h-3" />
                Lote Fixo
              </button>
              <button
                type="button"
                onClick={() => setLotType('percentage')}
                className={`flex-1 h-8 rounded-md text-[11px] font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 ${
                  lotType === 'percentage'
                    ? 'bg-amber-500/20 text-amber-400 shadow-sm border border-amber-500/30'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Percent className="w-3 h-3" />
                Lote por Porcentagem
              </button>
            </div>
          </div>

          {/* Fixed Lot Size */}
          {lotType === 'fixed' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Lote Fixo (Fixed Lot)</Label>
                <span className="text-xs font-bold tabular-nums text-cyan-400">{fixedLot.toFixed(2)}</span>
              </div>
              <Slider
                value={[fixedLot]}
                onValueChange={([v]) => setFixedLot(v)}
                min={0.01}
                max={1.0}
                step={0.01}
                className="w-full"
              />
              <div className="flex justify-between text-[8px] text-muted-foreground">
                <span>0.01</span>
                <span>1.00</span>
              </div>
              <p className="text-[9px] text-muted-foreground">
                Uses the same lot size for every trade regardless of account balance.
              </p>
            </div>
          )}

          {/* Percentage-based Lot */}
          {lotType === 'percentage' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Porcentagem de Risco (Risk %)</Label>
                <span className="text-xs font-bold tabular-nums text-amber-400">{lotPercentage}%</span>
              </div>
              <Slider
                value={[lotPercentage]}
                onValueChange={([v]) => setLotPercentage(v)}
                min={0.5}
                max={5}
                step={0.5}
                className="w-full"
              />
              <div className="flex justify-between text-[8px] text-muted-foreground">
                <span>0.5%</span>
                <span>5.0%</span>
              </div>
              <p className="text-[9px] text-muted-foreground">
                Calculates lot size based on {lotPercentage}% of account balance and SL distance.
                {status.mt5Balance != null && (
                  <span className="text-amber-400">
                    {' '}At ${formatMoney(status.mt5Balance)} balance, risk per trade ≈ ${((status.mt5Balance * lotPercentage) / 100).toFixed(2)}
                  </span>
                )}
              </p>
            </div>
          )}

          <Separator className="bg-border/30" />

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={updating}
            className="w-full h-9 text-xs bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-700 hover:to-red-700 text-white"
          >
            {updating ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Shield className="w-3.5 h-3.5 mr-1.5" />
            )}
            Save Risk Settings
          </Button>
        </CardContent>
      </Card>

      {/* Risk Warning */}
      <Card className="bg-card/80 border-border/40">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-amber-400">Risk Disclaimer</h4>
              <ul className="text-[9px] text-muted-foreground space-y-0.5 list-disc pl-3">
                <li>Setting a profit target helps lock in daily gains</li>
                <li>Setting a loss limit protects against large drawdowns</li>
                <li>When either limit is reached, the bot stops trading until the next day</li>
                <li>Lot sizing by percentage adjusts position size based on your balance</li>
                <li>Always test with a DEMO account before using LIVE</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


// ===================== Tab 4: Auto-Trading Config =====================

function ConfigTab({
  config,
  status,
  onSave,
  onToggle,
  updating,
  toggling,
}: {
  config: MT5Config | null;
  status: MT5Status;
  onSave: (updates: Record<string, unknown>) => void;
  onToggle: (active: boolean) => void;
  updating: boolean;
  toggling: boolean;
}) {
  const [isActive, setIsActive] = useState(false);
  const [lotSize, setLotSize] = useState(0.01);
  const [riskPercent, setRiskPercent] = useState(2);
  const [maxPositions, setMaxPositions] = useState(5);
  const [minConfidence, setMinConfidence] = useState(65);
  const [defaultSL, setDefaultSL] = useState(50);
  const [defaultTP, setDefaultTP] = useState(100);
  const [tradingStart, setTradingStart] = useState('08:00');
  const [tradingEnd, setTradingEnd] = useState('20:00');
  const [strategies, setStrategies] = useState({ smc: true, priceAction: true, hybrid: false });
  const [allowedSymbols, setAllowedSymbols] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  // Sync local state when config changes (during render, not in effect)
  const [lastConfigId, setLastConfigId] = useState<string | null>(null);
  if (config && config.id !== lastConfigId) {
    setLastConfigId(config.id);
    setIsActive(config.auto_trading_enabled ?? false);
    setLotSize(config.max_lot_size ?? 0.01);
    setRiskPercent(config.risk_per_trade_pct ?? 2);
    setMaxPositions(config.max_open_positions ?? 5);
    setMinConfidence(config.min_confidence ?? 65);
    setDefaultSL(config.stop_loss_default_pips ?? 50);
    setDefaultTP(config.take_profit_default_pips ?? 100);
    setTradingStart(config.trading_hours_start ?? '08:00');
    setTradingEnd(config.trading_hours_end ?? '20:00');
    setAllowedSymbols(Array.isArray(config.allowed_symbols) ? config.allowed_symbols.join(', ') : (config.allowed_symbols || ''));
  }
  // Sync isActive from status
  const [lastIsActive, setLastIsActive] = useState<boolean | undefined>(undefined);
  if (status.isActive !== lastIsActive) {
    setLastIsActive(status.isActive);
    setIsActive(status.isActive);
  }

  const handleToggleChange = useCallback((checked: boolean) => {
    if (checked) {
      setShowConfirm(true);
    } else {
      onToggle(false);
      setIsActive(false);
    }
  }, [onToggle]);

  const handleConfirmEnable = useCallback(() => {
    setShowConfirm(false);
    onToggle(true);
    setIsActive(true);
  }, [onToggle]);

  const handleSave = useCallback(() => {
    onSave({
      auto_trading_enabled: isActive,
      max_lot_size: lotSize,
      risk_per_trade_pct: riskPercent,
      max_open_positions: maxPositions,
      min_confidence: minConfidence,
      stop_loss_default_pips: defaultSL,
      take_profit_default_pips: defaultTP,
      trading_hours_start: tradingStart,
      trading_hours_end: tradingEnd,
      allowed_symbols: allowedSymbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean),
    });
    toast.success('Configuration saved', { description: 'Your MT5 auto-trading settings have been updated.' });
  }, [isActive, lotSize, riskPercent, maxPositions, minConfidence, defaultSL, defaultTP, tradingStart, tradingEnd, allowedSymbols, onSave]);

  return (
    <div className="space-y-4">
      {/* Auto-Trading Toggle — prominent */}
      <Card className={`bg-card/80 border-border/40 transition-all duration-500 ${
        isActive ? 'border-emerald-500/40 shadow-[0_0_20px_rgba(52,211,153,0.1)]' : ''
      }`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-500 ${
                isActive
                  ? 'bg-emerald-500/20 shadow-[0_0_16px_rgba(52,211,153,0.3)]'
                  : 'bg-secondary/50'
              }`}>
                {isActive ? (
                  <Bot className="w-6 h-6 text-emerald-400" />
                ) : (
                  <Bot className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  Auto-Trading
                  {isActive && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] px-1.5 py-0 animate-pulse">
                      ACTIVE
                    </Badge>
                  )}
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  {isActive
                    ? 'Bot is executing signals automatically on your MT5 account'
                    : 'Bot will not execute trades until enabled'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {toggling && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              <Switch
                checked={isActive}
                onCheckedChange={handleToggleChange}
                disabled={toggling}
                className={isActive ? 'data-[state=checked]:bg-emerald-500' : ''}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation dialog when enabling */}
      {showConfirm && (
        <Card className="bg-amber-500/5 border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <h4 className="text-sm font-semibold text-amber-400">Enable Auto-Trading?</h4>
                <p className="text-[10px] text-muted-foreground">
                  The bot will automatically execute trading signals on your MT5 account. This involves significant financial risk.
                </p>
                <ul className="text-[9px] text-muted-foreground space-y-0.5 list-disc pl-3">
                  <li>Trades will execute without manual confirmation</li>
                  <li>You can lose your entire investment</li>
                  <li>Always use proper risk management settings</li>
                  <li>Monitor your positions regularly</li>
                </ul>
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={handleConfirmEnable}
                    className="h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Shield className="w-3 h-3 mr-1" />
                    I Understand — Enable
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowConfirm(false)}
                    className="h-7 text-[10px]"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration Options */}
      <Card className="bg-card/80 border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Settings className="w-4 h-4 text-cyan-400" />
            Trading Parameters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Lot Size Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Lot Size</Label>
              <span className="text-xs font-bold tabular-nums text-cyan-400">{lotSize.toFixed(2)}</span>
            </div>
            <Slider
              value={[lotSize]}
              onValueChange={([v]) => setLotSize(v)}
              min={0.01}
              max={1.0}
              step={0.01}
              className="w-full"
            />
            <div className="flex justify-between text-[8px] text-muted-foreground">
              <span>0.01</span>
              <span>1.00</span>
            </div>
          </div>

          {/* Risk per trade % */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Risk per Trade</Label>
              <span className="text-xs font-bold tabular-nums text-amber-400">{riskPercent}%</span>
            </div>
            <Slider
              value={[riskPercent]}
              onValueChange={([v]) => setRiskPercent(v)}
              min={0.5}
              max={5}
              step={0.5}
              className="w-full"
            />
            <div className="flex justify-between text-[8px] text-muted-foreground">
              <span>0.5%</span>
              <span>5.0%</span>
            </div>
          </div>

          {/* Max Open Positions */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Max Open Positions</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={maxPositions}
              onChange={(e) => setMaxPositions(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
              className="h-8 text-xs tabular-nums"
            />
          </div>

          {/* Min Confidence % */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Min Confidence</Label>
              <span className="text-xs font-bold tabular-nums text-emerald-400">{minConfidence}%</span>
            </div>
            <Slider
              value={[minConfidence]}
              onValueChange={([v]) => setMinConfidence(v)}
              min={50}
              max={100}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-[8px] text-muted-foreground">
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          <Separator className="bg-border/30" />

          {/* Default SL / TP */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Default Stop Loss (pips)</Label>
              <Input
                type="number"
                min={1}
                max={500}
                value={defaultSL}
                onChange={(e) => setDefaultSL(parseInt(e.target.value) || 1)}
                className="h-8 text-xs tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Default Take Profit (pips)</Label>
              <Input
                type="number"
                min={1}
                max={500}
                value={defaultTP}
                onChange={(e) => setDefaultTP(parseInt(e.target.value) || 1)}
                className="h-8 text-xs tabular-nums"
              />
            </div>
          </div>

          {/* Trading Hours */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Timer className="w-3 h-3 text-muted-foreground" />
              <Label className="text-xs text-muted-foreground">Trading Hours</Label>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={tradingStart}
                onChange={(e) => setTradingStart(e.target.value)}
                className="h-8 text-xs"
              />
              <span className="text-[10px] text-muted-foreground">to</span>
              <Input
                type="time"
                value={tradingEnd}
                onChange={(e) => setTradingEnd(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <Separator className="bg-border/30" />

          {/* Strategy Filters */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Target className="w-3 h-3 text-muted-foreground" />
              <Label className="text-xs text-muted-foreground">Strategy Filters</Label>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="strat-smc"
                  checked={strategies.smc}
                  onCheckedChange={(checked) => setStrategies(prev => ({ ...prev, smc: !!checked }))}
                />
                <label htmlFor="strat-smc" className="text-xs cursor-pointer">
                  <span className="font-medium text-cyan-400">SMC</span>
                  <span className="text-muted-foreground ml-1">— Smart Money Concepts</span>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="strat-pa"
                  checked={strategies.priceAction}
                  onCheckedChange={(checked) => setStrategies(prev => ({ ...prev, priceAction: !!checked }))}
                />
                <label htmlFor="strat-pa" className="text-xs cursor-pointer">
                  <span className="font-medium text-emerald-400">Price Action</span>
                  <span className="text-muted-foreground ml-1">— Pure technical patterns</span>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="strat-hybrid"
                  checked={strategies.hybrid}
                  onCheckedChange={(checked) => setStrategies(prev => ({ ...prev, hybrid: !!checked }))}
                />
                <label htmlFor="strat-hybrid" className="text-xs cursor-pointer">
                  <span className="font-medium text-amber-400">Hybrid</span>
                  <span className="text-muted-foreground ml-1">— Combined SMC + Price Action</span>
                </label>
              </div>
            </div>
          </div>

          {/* Allowed Symbols */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Allowed Symbols</Label>
            <Input
              type="text"
              placeholder="EURUSD, GBPUSD, USDJPY (empty = all)"
              value={allowedSymbols}
              onChange={(e) => setAllowedSymbols(e.target.value)}
              className="h-8 text-xs"
            />
            <p className="text-[9px] text-muted-foreground">Comma-separated. Leave empty to allow all symbols.</p>
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={updating}
            className="w-full h-9 text-xs bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700 text-white"
          >
            {updating ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Settings className="w-3.5 h-3.5 mr-1.5" />
            )}
            Save Configuration
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}


// ===================== Tab 5: Signals =====================

function SignalsTab({
  signals,
  onConfirmSignal,
  loading,
}: {
  signals: MT5Signal[];
  onConfirmSignal: (signalId: string, action: 'executed' | 'skipped') => void;
  loading: boolean;
}) {
  const pendingCountVal = signals.filter(s => s.status === 'pending').length;

  return (
    <div className="space-y-3">
      {/* Header bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold">Recent Signals</span>
          <Badge variant="outline" className="text-[9px] px-1.5 border-cyan-500/30 text-cyan-400">
            {signals.length}
          </Badge>
          {pendingCountVal > 0 && (
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[9px] px-1.5">
              {pendingCountVal} pending
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <RefreshCw className="w-3 h-3 text-muted-foreground animate-spin opacity-0" />
          <span className="text-[9px] text-muted-foreground">Auto-refresh 30s</span>
        </div>
      </div>

      {/* Signals table */}
      {signals.length === 0 ? (
        <Card className="bg-card/80 border-border/40">
          <CardContent className="p-8 text-center">
            <Zap className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No signals yet</p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">Signals will appear here when the AI generates trade ideas</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card/80 border-border/40">
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[9px] h-8">Time</TableHead>
                    <TableHead className="text-[9px] h-8">Symbol</TableHead>
                    <TableHead className="text-[9px] h-8">Dir</TableHead>
                    <TableHead className="text-[9px] h-8">Entry</TableHead>
                    <TableHead className="text-[9px] h-8">SL</TableHead>
                    <TableHead className="text-[9px] h-8">TP</TableHead>
                    <TableHead className="text-[9px] h-8">Conf</TableHead>
                    <TableHead className="text-[9px] h-8">Status</TableHead>
                    <TableHead className="text-[9px] h-8">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {signals.map((signal) => {
                    const isBuy = signal.direction === 'BUY';
                    return (
                      <TableRow key={signal.id} className="hover:bg-secondary/30">
                        <TableCell className="text-[10px] tabular-nums text-muted-foreground py-2">
                          {formatDateTime(signal.createdAt)}
                        </TableCell>
                        <TableCell className="text-xs font-medium py-2">
                          {signal.pair}
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge className={
                            isBuy
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] px-1.5 py-0'
                              : 'bg-red-500/20 text-red-400 border-red-500/30 text-[9px] px-1.5 py-0'
                          }>
                            {isBuy ? 'BUY' : 'SELL'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[10px] tabular-nums py-2">
                          {signal.entry}
                        </TableCell>
                        <TableCell className="text-[10px] tabular-nums py-2 text-red-400/70">
                          {signal.stopLoss}
                        </TableCell>
                        <TableCell className="text-[10px] tabular-nums py-2 text-emerald-400/70">
                          {signal.takeProfit}
                        </TableCell>
                        <TableCell className="py-2">
                          <span className={`text-[10px] font-semibold tabular-nums ${
                            signal.probability >= 75 ? 'text-emerald-400' :
                            signal.probability >= 60 ? 'text-amber-400' :
                            'text-red-400'
                          }`}>
                            {signal.probability}%
                          </span>
                        </TableCell>
                        <TableCell className="py-2">
                          <SignalStatusBadge status={signal.status} />
                        </TableCell>
                        <TableCell className="py-2">
                          {signal.status === 'pending' ? (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onConfirmSignal(signal.id, 'executed')}
                                disabled={loading}
                                className="h-6 w-6 p-0 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                                title="Execute"
                              >
                                <Check className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onConfirmSignal(signal.id, 'skipped')}
                                disabled={loading}
                                className="h-6 w-6 p-0 text-gray-400 hover:text-gray-300 hover:bg-gray-500/10"
                                title="Skip"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[9px] text-muted-foreground/40">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


// ===================== Tab 6: Positions =====================

function PositionsTab({
  positions,
  onClosePosition,
  loading,
}: {
  positions: MT5Position[];
  onClosePosition: (ticket: number) => void;
  loading: boolean;
}) {
  const totalPnL = positions.reduce((sum, pos) => sum + (pos.profit || 0), 0);
  const totalPositions = positions.length;

  return (
    <div className="space-y-3">
      {/* Header bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold">Open Positions</span>
          <Badge variant="outline" className="text-[9px] px-1.5 border-emerald-500/30 text-emerald-400">
            {totalPositions}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-muted-foreground uppercase">Total P&L</span>
          <span className={`text-sm font-bold tabular-nums ${totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Positions table */}
      {positions.length === 0 ? (
        <Card className="bg-card/80 border-border/40">
          <CardContent className="p-8 text-center">
            <Bot className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No open positions</p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">Positions will appear here when trades are executed</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card/80 border-border/40">
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[9px] h-8">Ticket</TableHead>
                    <TableHead className="text-[9px] h-8">Symbol</TableHead>
                    <TableHead className="text-[9px] h-8">Dir</TableHead>
                    <TableHead className="text-[9px] h-8">Lot</TableHead>
                    <TableHead className="text-[9px] h-8">Entry</TableHead>
                    <TableHead className="text-[9px] h-8">Current</TableHead>
                    <TableHead className="text-[9px] h-8 text-right">Profit</TableHead>
                    <TableHead className="text-[9px] h-8">Pips</TableHead>
                    <TableHead className="text-[9px] h-8">Open Time</TableHead>
                    <TableHead className="text-[9px] h-8">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((pos) => {
                    const pnl = pos.profit || 0;
                    const isBuy = pos.direction === 'BUY';
                    return (
                      <TableRow key={pos.id} className="hover:bg-secondary/30">
                        <TableCell className="text-[10px] tabular-nums text-muted-foreground py-2">
                          #{pos.mt5Ticket}
                        </TableCell>
                        <TableCell className="text-xs font-medium py-2">
                          {pos.pair}
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge className={
                            isBuy
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] px-1.5 py-0'
                              : 'bg-red-500/20 text-red-400 border-red-500/30 text-[9px] px-1.5 py-0'
                          }>
                            {isBuy ? 'BUY' : 'SELL'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[10px] tabular-nums py-2">
                          {pos.lotSize}
                        </TableCell>
                        <TableCell className="text-[10px] tabular-nums py-2">
                          {formatPrice(pos.openPrice)}
                        </TableCell>
                        <TableCell className="text-[10px] tabular-nums py-2">
                          {formatPrice(pos.currentPrice)}
                        </TableCell>
                        <TableCell className={`text-[10px] font-semibold tabular-nums text-right py-2 ${
                          pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                        </TableCell>
                        <TableCell className={`text-[10px] tabular-nums py-2 ${
                          (pos.profitPips || 0) >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'
                        }`}>
                          {pos.profitPips != null ? (pos.profitPips >= 0 ? '+' : '') + pos.profitPips.toFixed(1) : '—'}
                        </TableCell>
                        <TableCell className="text-[10px] tabular-nums text-muted-foreground py-2">
                          {formatTime(pos.openTime)}
                        </TableCell>
                        <TableCell className="py-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onClosePosition(pos.mt5Ticket)}
                            disabled={loading}
                            className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            title="Close position"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>

            {/* Summary footer */}
            <div className="border-t border-border/30 px-4 py-2.5 flex items-center justify-between bg-secondary/20">
              <span className="text-[10px] text-muted-foreground uppercase">
                Total P&L ({totalPositions} position{totalPositions !== 1 ? 's' : ''})
              </span>
              <span className={`text-sm font-bold tabular-nums ${totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


// ===================== Tab 7: Statistics =====================

function StatisticsTab({
  signals,
  positions,
}: {
  signals: MT5Signal[];
  positions: MT5Position[];
}) {
  // Calculate stats from available data
  const totalSignals = signals.length;
  const executedSignals = signals.filter(s => s.status === 'executed').length;
  const failedSignals = signals.filter(s => s.status === 'failed').length;

  // Win rate estimation from signals with probability
  const avgProbability = totalSignals > 0
    ? Math.round(signals.reduce((sum, s) => sum + s.probability, 0) / totalSignals)
    : 0;

  // Current P&L from positions
  const totalPnL = positions.reduce((sum, pos) => sum + (pos.profit || 0), 0);
  const profitablePositions = positions.filter(pos => (pos.profit || 0) > 0).length;
  const winRate = positions.length > 0
    ? Math.round((profitablePositions / positions.length) * 100)
    : 0;

  const avgProfit = positions.length > 0
    ? totalPnL / positions.length
    : 0;

  const bestTrade = positions.length > 0
    ? Math.max(...positions.map(p => p.profit || 0))
    : 0;

  const worstTrade = positions.length > 0
    ? Math.min(...positions.map(p => p.profit || 0))
    : 0;

  // Signal strategy breakdown
  const smcCount = signals.filter(s => s.strategy?.toLowerCase().includes('smc')).length;
  const paCount = signals.filter(s => s.strategy?.toLowerCase().includes('price')).length;
  const hybridCount = signals.filter(s => s.strategy?.toLowerCase().includes('hybrid')).length;

  const pendingSignalsCount = signals.filter(s => s.status === 'pending').length;

  return (
    <div className="space-y-4">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={Zap}
          label="Total Signals"
          value={totalSignals.toString()}
          subValue={`${pendingSignalsCount} pending`}
          color="text-cyan-400"
          bgColor="bg-cyan-500/10"
        />
        <StatCard
          icon={Check}
          label="Signals Executed"
          value={executedSignals.toString()}
          subValue={`${failedSignals} failed`}
          color="text-emerald-400"
          bgColor="bg-emerald-500/10"
        />
        <StatCard
          icon={Trophy}
          label="Win Rate"
          value={`${winRate}%`}
          subValue={positions.length > 0 ? `${profitablePositions}/${positions.length} profitable` : 'No closed trades'}
          color={winRate >= 60 ? 'text-emerald-400' : winRate >= 40 ? 'text-amber-400' : 'text-red-400'}
          bgColor={winRate >= 60 ? 'bg-emerald-500/10' : winRate >= 40 ? 'bg-amber-500/10' : 'bg-red-500/10'}
        />
        <StatCard
          icon={DollarSign}
          label="Total P&L"
          value={`${totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}`}
          subValue={`${positions.length} open position${positions.length !== 1 ? 's' : ''}`}
          color={totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}
          bgColor={totalPnL >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}
        />
      </div>

      {/* Secondary Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={BarChart3}
          label="Avg Profit"
          value={`${avgProfit >= 0 ? '+' : ''}${avgProfit.toFixed(2)}`}
          color={avgProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}
          bgColor={avgProfit >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}
        />
        <StatCard
          icon={ArrowUpRight}
          label="Best Trade"
          value={`+${bestTrade.toFixed(2)}`}
          color="text-emerald-400"
          bgColor="bg-emerald-500/10"
        />
        <StatCard
          icon={ArrowDownRight}
          label="Worst Trade"
          value={worstTrade.toFixed(2)}
          color="text-red-400"
          bgColor="bg-red-500/10"
        />
      </div>

      {/* Strategy Breakdown */}
      <Card className="bg-card/80 border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Target className="w-4 h-4 text-amber-400" />
            Strategy Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* SMC */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-cyan-400 font-medium">SMC</span>
              <span className="text-[10px] tabular-nums text-muted-foreground">{smcCount} signals</span>
            </div>
            <div className="h-2 bg-secondary/50 rounded-full overflow-hidden">
              <div
                className="bg-cyan-500/60 transition-all duration-500 rounded-full h-full"
                style={{ width: `${totalSignals > 0 ? (smcCount / totalSignals) * 100 : 0}%` }}
              />
            </div>
          </div>
          {/* Price Action */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-400 font-medium">Price Action</span>
              <span className="text-[10px] tabular-nums text-muted-foreground">{paCount} signals</span>
            </div>
            <div className="h-2 bg-secondary/50 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500/60 transition-all duration-500 rounded-full h-full"
                style={{ width: `${totalSignals > 0 ? (paCount / totalSignals) * 100 : 0}%` }}
              />
            </div>
          </div>
          {/* Hybrid */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-amber-400 font-medium">Hybrid</span>
              <span className="text-[10px] tabular-nums text-muted-foreground">{hybridCount} signals</span>
            </div>
            <div className="h-2 bg-secondary/50 rounded-full overflow-hidden">
              <div
                className="bg-amber-500/60 transition-all duration-500 rounded-full h-full"
                style={{ width: `${totalSignals > 0 ? (hybridCount / totalSignals) * 100 : 0}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Avg Confidence */}
      <Card className="bg-card/80 border-border/40">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-muted-foreground">Average Signal Confidence</span>
            </div>
            <span className={`text-lg font-bold tabular-nums ${
              avgProbability >= 70 ? 'text-emerald-400' :
              avgProbability >= 55 ? 'text-amber-400' :
              'text-red-400'
            }`}>
              {avgProbability}%
            </span>
          </div>
          <div className="h-2.5 bg-secondary/50 rounded-full overflow-hidden mt-2">
            <div
              className={`transition-all duration-500 rounded-full h-full ${
                avgProbability >= 70 ? 'bg-emerald-500/60' :
                avgProbability >= 55 ? 'bg-amber-500/60' :
                'bg-red-500/60'
              }`}
              style={{ width: `${avgProbability}%` }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


// ===================== Main Component =====================

export function MT5Dashboard() {
  // State
  const [config, setConfig] = useState<MT5Config | null>(null);
  const [status, setStatus] = useState<MT5Status>({
    botStatus: 'offline',
    lastHeartbeat: null,
    mt5Account: null,
    mt5Broker: null,
    mt5Balance: null,
    mt5Equity: null,
    mt5Leverage: null,
    mt5Currency: null,
    isActive: false,
    botVersion: null,
    openPositions: 0,
  });
  const [positions, setPositions] = useState<MT5Position[]>([]);
  const [signals, setSignals] = useState<MT5Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState('status');

  // AbortController refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // Fetch all data
  const fetchAllData = useCallback(async () => {
    try {
      const [configRes, statusRes, positionsRes, signalsRes] = await Promise.allSettled([
        fetch('/api/mt5/config', { signal: abortControllerRef.current?.signal }),
        fetch('/api/mt5/status', { signal: abortControllerRef.current?.signal }),
        fetch('/api/mt5/positions', { signal: abortControllerRef.current?.signal }),
        fetch('/api/mt5/signals?status=all&limit=50', { signal: abortControllerRef.current?.signal }),
      ]);

      if (configRes.status === 'fulfilled') {
        const json = await configRes.value.json();
        if (json.success && json.data) setConfig(json.data);
      }
      if (statusRes.status === 'fulfilled') {
        const json = await statusRes.value.json();
        if (json.success && json.data) {
          const d = json.data;
          // Map API snake_case to frontend camelCase
          setStatus({
            botStatus: d.connected ? 'online' : (d.mt5_connected ? 'connecting' : 'offline'),
            lastHeartbeat: d.last_heartbeat ?? null,
            mt5Account: d.mt5_login != null ? String(d.mt5_login) : null,
            mt5Broker: d.mt5_server ?? null,
            mt5Balance: d.account_balance ?? null,
            mt5Equity: d.account_equity ?? null,
            mt5Leverage: d.account_leverage ?? null,
            mt5Currency: d.account_currency ?? null,
            isActive: d.connected ?? false,
            botVersion: d.bot_version ?? null,
            openPositions: d.open_positions_count ?? 0,
            mt5_connected: d.mt5_connected ?? false,
            mt5_login: d.mt5_login ?? null,
            mt5_server: d.mt5_server ?? null,
            mt5_account_type: d.mt5_account_type ?? null,
            isStale: d.isStale ?? false,
            lastHeartbeatAge: d.lastHeartbeatAge ?? null,
          });
        }
      }
      if (positionsRes.status === 'fulfilled') {
        const json = await positionsRes.value.json();
        if (json.success && json.data) {
          // Map API snake_case to frontend camelCase
          setPositions(json.data.map((p: any) => ({
            id: p.id,
            signalId: p.signal_id ?? null,
            mt5Ticket: p.ticket ?? 0,
            pair: p.symbol ?? '',
            direction: p.direction ?? 'BUY',
            lotSize: p.lot_size ?? 0,
            openPrice: p.entry_price ?? 0,
            currentPrice: p.current_price ?? null,
            stopLoss: p.stop_loss ?? null,
            takeProfit: p.take_profit ?? null,
            profit: p.profit ?? null,
            profitPips: p.profit_pips ?? null,
            swap: null,
            openTime: p.open_time ?? '',
          })));
        }
      }
      if (signalsRes.status === 'fulfilled') {
        const json = await signalsRes.value.json();
        if (json.success && json.data) {
          // Map API snake_case to frontend camelCase
          setSignals(json.data.map((s: any) => ({
            id: s.id,
            pair: s.symbol ?? '',
            direction: s.direction ?? 'BUY',
            entry: String(s.entry_price ?? 0),
            stopLoss: String(s.stop_loss ?? 0),
            takeProfit: String(s.take_profit ?? 0),
            probability: s.confidence ?? 0,
            strategy: s.strategy ?? '',
            timeframe: '',
            status: s.status ?? 'pending',
            source: 'AI',
            mt5Ticket: s.mt5_ticket ?? null,
            executedAt: s.executed_at ?? null,
            executionPrice: null,
            executionLot: s.executed_lot ?? null,
            errorMessage: s.error_message ?? null,
            createdAt: s.created_at ?? '',
            updatedAt: s.updated_at ?? '',
          })));
        }
      }

      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('[MT5Dashboard] fetchAllData error:', err);
      setError('Network error loading data');
    }
  }, []);

  // Fetch status + positions (for auto-refresh)
  const fetchStatusAndPositions = useCallback(async () => {
    try {
      const controller = new AbortController();

      const [statusRes, positionsRes] = await Promise.allSettled([
        fetch('/api/mt5/status', { signal: controller.signal }),
        fetch('/api/mt5/positions', { signal: controller.signal }),
      ]);

      if (statusRes.status === 'fulfilled') {
        const json = await statusRes.value.json();
        if (json.success && json.data) {
          const d = json.data;
          setStatus({
            botStatus: d.connected ? 'online' : (d.mt5_connected ? 'connecting' : 'offline'),
            lastHeartbeat: d.last_heartbeat ?? null,
            mt5Account: d.mt5_login != null ? String(d.mt5_login) : null,
            mt5Broker: d.mt5_server ?? null,
            mt5Balance: d.account_balance ?? null,
            mt5Equity: d.account_equity ?? null,
            mt5Leverage: d.account_leverage ?? null,
            mt5Currency: d.account_currency ?? null,
            isActive: d.connected ?? false,
            botVersion: d.bot_version ?? null,
            openPositions: d.open_positions_count ?? 0,
            mt5_connected: d.mt5_connected ?? false,
            mt5_login: d.mt5_login ?? null,
            mt5_server: d.mt5_server ?? null,
            mt5_account_type: d.mt5_account_type ?? null,
            isStale: d.isStale ?? false,
            lastHeartbeatAge: d.lastHeartbeatAge ?? null,
          });
        }
      }
      if (positionsRes.status === 'fulfilled') {
        const json = await positionsRes.value.json();
        if (json.success && json.data) {
          setPositions(json.data.map((p: any) => ({
            id: p.id,
            signalId: p.signal_id ?? null,
            mt5Ticket: p.ticket ?? 0,
            pair: p.symbol ?? '',
            direction: p.direction ?? 'BUY',
            lotSize: p.lot_size ?? 0,
            openPrice: p.entry_price ?? 0,
            currentPrice: p.current_price ?? null,
            stopLoss: p.stop_loss ?? null,
            takeProfit: p.take_profit ?? null,
            profit: p.profit ?? null,
            profitPips: p.profit_pips ?? null,
            swap: null,
            openTime: p.open_time ?? '',
          })));
        }
      }
      setLastUpdated(new Date());
    } catch {
      // Silently ignore refresh errors
    }
  }, []);

  // Initial load
  useEffect(() => {
    mountedRef.current = true;

    const load = async () => {
      setLoading(true);
      await fetchAllData();
      if (mountedRef.current) setLoading(false);
    };

    load();

    // Auto-refresh every 30 seconds
    intervalRef.current = setInterval(() => {
      fetchStatusAndPositions();
    }, 30000);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchAllData, fetchStatusAndPositions]);

  // Manual refresh
  const handleRefresh = useCallback(async () => {
    setLoading(true);
    await fetchAllData();
    setLoading(false);
    toast.success('Data refreshed');
  }, [fetchAllData]);

  // Toggle auto-trading
  const handleToggleAutoTrading = useCallback(async (active: boolean) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/mt5/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_trading_enabled: active }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setConfig(json.data);
        setStatus(prev => ({ ...prev, isActive: active }));
        toast.success(active ? 'Auto-Trading enabled' : 'Auto-Trading disabled');
      } else {
        toast.error(json.error || 'Failed to toggle auto-trading');
      }
    } catch {
      toast.error('Network error toggling auto-trading');
    } finally {
      setActionLoading(false);
    }
  }, []);

  // Save config
  const handleSaveConfig = useCallback(async (updates: Record<string, unknown>) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/mt5/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setConfig(json.data);
      } else {
        toast.error(json.error || 'Failed to save configuration');
      }
    } catch {
      toast.error('Network error saving configuration');
    } finally {
      setActionLoading(false);
    }
  }, []);

  // Confirm/skip signal
  const handleConfirmSignal = useCallback(async (signalId: string, action: 'executed' | 'skipped') => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/mt5/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signalId, action: action === 'executed' ? 'execute' : 'skip' }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setSignals(prev => prev.map(s => s.id === signalId ? { ...s, status: action } : s));
        toast.success(action === 'executed' ? 'Signal executed' : 'Signal skipped');
      } else {
        toast.error(json.error || 'Failed to update signal');
      }
    } catch {
      toast.error('Network error updating signal');
    } finally {
      setActionLoading(false);
    }
  }, []);

  // Close position
  const handleClosePosition = useCallback(async (ticket: number) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/mt5/positions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket }),
      });
      const json = await res.json();
      if (json.success) {
        setPositions(prev => prev.filter(p => p.mt5Ticket !== ticket));
        toast.success(`Position #${ticket} closed`);
      } else {
        toast.error(json.error || 'Failed to close position');
      }
    } catch {
      toast.error('Network error closing position');
    } finally {
      setActionLoading(false);
    }
  }, []);

  // Loading skeleton
  if (loading && !config) {
    return (
      <Card className="bg-card/80 border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Bot className="w-4 h-4 text-cyan-400" />
            MT5 Auto-Trading Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TabSkeleton rows={6} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-xs text-red-400 flex-1">{error}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            className="h-6 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Retry
          </Button>
        </div>
      )}

      {/* Dashboard Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full bg-muted/50 h-9 p-[3px]">
          <TabsTrigger value="status" className="text-[10px] gap-1 flex-1">
            <Wifi className="w-3 h-3" />
            <span className="hidden sm:inline">Status</span>
          </TabsTrigger>
          <TabsTrigger value="broker" className="text-[10px] gap-1 flex-1">
            <Link2 className="w-3 h-3" />
            <span className="hidden sm:inline">Broker</span>
          </TabsTrigger>
          <TabsTrigger value="risk" className="text-[10px] gap-1 flex-1">
            <Shield className="w-3 h-3" />
            <span className="hidden sm:inline">Risk</span>
          </TabsTrigger>
          <TabsTrigger value="config" className="text-[10px] gap-1 flex-1">
            <Settings className="w-3 h-3" />
            <span className="hidden sm:inline">Config</span>
          </TabsTrigger>
          <TabsTrigger value="signals" className="text-[10px] gap-1 flex-1 relative">
            <Zap className="w-3 h-3" />
            <span className="hidden sm:inline">Signals</span>
            {signals.filter(s => s.status === 'pending').length > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 rounded-full text-[7px] text-white flex items-center justify-center font-bold">
                {signals.filter(s => s.status === 'pending').length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="positions" className="text-[10px] gap-1 flex-1 relative">
            <TrendingUp className="w-3 h-3" />
            <span className="hidden sm:inline">Positions</span>
            {positions.length > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-cyan-500 rounded-full text-[7px] text-white flex items-center justify-center font-bold">
                {positions.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="stats" className="text-[10px] gap-1 flex-1">
            <BarChart3 className="w-3 h-3" />
            <span className="hidden sm:inline">Stats</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="status">
          <StatusTab
            status={status}
            positions={positions}
            onRefresh={handleRefresh}
            loading={loading}
            lastUpdated={lastUpdated}
          />
        </TabsContent>

        <TabsContent value="broker">
          <BrokerConnectionTab
            config={config}
            status={status}
            onSave={handleSaveConfig}
            updating={actionLoading}
          />
        </TabsContent>

        <TabsContent value="risk">
          <RiskManagementTab
            config={config}
            status={status}
            onSave={handleSaveConfig}
            updating={actionLoading}
          />
        </TabsContent>

        <TabsContent value="config">
          <ConfigTab
            config={config}
            status={status}
            onSave={handleSaveConfig}
            onToggle={handleToggleAutoTrading}
            updating={actionLoading}
            toggling={actionLoading}
          />
        </TabsContent>

        <TabsContent value="signals">
          <SignalsTab
            signals={signals}
            onConfirmSignal={handleConfirmSignal}
            loading={actionLoading}
          />
        </TabsContent>

        <TabsContent value="positions">
          <PositionsTab
            positions={positions}
            onClosePosition={handleClosePosition}
            loading={actionLoading}
          />
        </TabsContent>

        <TabsContent value="stats">
          <StatisticsTab
            signals={signals}
            positions={positions}
          />
        </TabsContent>
      </Tabs>

      {/* Auto-refresh indicator */}
      <div className="flex items-center justify-center gap-1.5 px-1">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 animate-pulse" />
        <span className="text-[9px] text-muted-foreground">
          Auto-refresh every 30s
          {lastUpdated && ` — Last: ${lastUpdated.toLocaleTimeString()}`}
        </span>
      </div>
    </div>
  );
}

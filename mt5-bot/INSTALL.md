# ForexAI MT5 Bot — Guia de Instalacao

Guia completo para instalar e configurar o bot de auto-trading ForexAI no seu VPS Windows.

---

## Pre-requisitos

- **VPS Windows** (Windows Server 2016+ ou Windows 10/11)
- **MetaTrader 5** instalado e funcionando
- **Python 3.10+** instalado
- **Conta no Supabase** (mesmo projeto do ForexAI)
- **Chave Service Role** do Supabase

---

## Instalacao Passo a Passo

### 1. Instalar o Python

Baixe e instale o Python 3.10+ em [python.org](https://www.python.org/downloads/).

**Importante**: Durante a instalacao, marque a opcao **"Add Python to PATH"**.

Para verificar se esta instalado:
```
python --version
```

### 2. Instalar o MetaTrader 5

- Baixe o MT5 em [metatrader5.com](https://www.metatrader5.com/pt)
- Instale e abra o MT5
- Faca login com sua conta de trading (demo ou real)
- Certifique-se de que o MT5 esta rodando e conectado

### 3. Copiar os Arquivos do Bot

Copie a pasta `mt5-bot/` inteira para o VPS, por exemplo:
```
C:\ForexAI\mt5-bot\
```

### 4. Criar o Ambiente Virtual (Recomendado)

Abra o Prompt de Comando (cmd) e execute:
```
cd C:\ForexAI\mt5-bot
python -m venv venv
venv\Scripts\activate
```

### 5. Instalar as Dependencias

```
pip install -r requirements.txt
```

As dependencias sao:
- `MetaTrader5==5.0.45` — integracao com o terminal MT5
- `requests>=2.31.0` — chamadas HTTP para o Supabase
- `python-dotenv>=1.0.0` — leitura do arquivo .env
- `schedule>=1.2.0` — agendamento de tarefas

### 6. Configurar o Arquivo .env

Copie o arquivo de exemplo:
```
copy .env.example .env
```

Edite o `.env` com suas configuracoes:

```env
# Supabase credentials (mesmo projeto do ForexAI)
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_KEY=sua-chave-service-role

# MT5 Terminal settings
MT5_LOGIN=12345678
MT5_PASSWORD=sua-senha
MT5_SERVER=MetaQuotes-Demo
MT5_PATH=C:\Program Files\MetaTrader 5\terminal64.exe

# Bot settings
POLL_INTERVAL=30
LOG_LEVEL=INFO
```

#### Onde encontrar cada valor:

| Campo | Onde Encontrar |
|-------|---------------|
| `SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `SUPABASE_SERVICE_KEY` | Supabase Dashboard → Settings → API → service_role key |
| `MT5_LOGIN` | MT5 → Arquivo → Login — numero da conta |
| `MT5_PASSWORD` | Senha da sua conta MT5 |
| `MT5_SERVER` | MT5 → nome do servidor do broker (ex: MetaQuotes-Demo, XPMT5-Real) |
| `MT5_PATH` | Caminho do terminal64.exe no VPS |

---

## Criar as Tabelas no Supabase

Antes de rodar o bot, voce precisa criar as tabelas no Supabase.

1. Acesse o **Supabase Dashboard**
2. Vá em **SQL Editor**
3. Cole o SQL abaixo e clique em **Run**:

```sql
-- MT5 Signals Table
CREATE TABLE IF NOT EXISTS mt5_signals (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('BUY', 'SELL')),
  entry_price DOUBLE PRECISION NOT NULL,
  stop_loss DOUBLE PRECISION NOT NULL,
  take_profit DOUBLE PRECISION NOT NULL,
  confidence INTEGER NOT NULL DEFAULT 0,
  strategy TEXT NOT NULL DEFAULT 'hybrid',
  lot_size DOUBLE PRECISION NOT NULL DEFAULT 0.01,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'skipped', 'expired', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_at TIMESTAMPTZ
);

-- MT5 Positions Table
CREATE TABLE IF NOT EXISTS mt5_positions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  ticket BIGINT NOT NULL,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('BUY', 'SELL')),
  lot_size DOUBLE PRECISION NOT NULL,
  entry_price DOUBLE PRECISION NOT NULL,
  stop_loss DOUBLE PRECISION NOT NULL DEFAULT 0,
  take_profit DOUBLE PRECISION NOT NULL DEFAULT 0,
  current_price DOUBLE PRECISION NOT NULL DEFAULT 0,
  profit DOUBLE PRECISION NOT NULL DEFAULT 0,
  profit_pips DOUBLE PRECISION NOT NULL DEFAULT 0,
  open_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  close_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'error')),
  signal_id TEXT
);

-- MT5 Bot Status Table (single row)
CREATE TABLE IF NOT EXISTS mt5_bot_status (
  id TEXT PRIMARY KEY DEFAULT '1',
  connected BOOLEAN NOT NULL DEFAULT false,
  mt5_connected BOOLEAN NOT NULL DEFAULT false,
  account_balance DOUBLE PRECISION NOT NULL DEFAULT 0,
  account_equity DOUBLE PRECISION NOT NULL DEFAULT 0,
  account_leverage INTEGER NOT NULL DEFAULT 0,
  account_currency TEXT NOT NULL DEFAULT 'USD',
  open_positions_count INTEGER NOT NULL DEFAULT 0,
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT now(),
  server_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  bot_version TEXT NOT NULL DEFAULT '1.0.0',
  mt5_terminal_path TEXT NOT NULL DEFAULT ''
);

-- MT5 Config Table (single row)
CREATE TABLE IF NOT EXISTS mt5_config (
  id TEXT PRIMARY KEY DEFAULT '1',
  auto_trading_enabled BOOLEAN NOT NULL DEFAULT false,
  max_lot_size DOUBLE PRECISION NOT NULL DEFAULT 0.1,
  risk_per_trade_pct DOUBLE PRECISION NOT NULL DEFAULT 2.0,
  allowed_symbols TEXT NOT NULL DEFAULT '[]',
  max_open_positions INTEGER NOT NULL DEFAULT 5,
  min_confidence INTEGER NOT NULL DEFAULT 70,
  strategy_filter TEXT NOT NULL DEFAULT '[]',
  stop_loss_default_pips INTEGER NOT NULL DEFAULT 50,
  take_profit_default_pips INTEGER NOT NULL DEFAULT 100,
  trading_hours_start TEXT NOT NULL DEFAULT '09:00',
  trading_hours_end TEXT NOT NULL DEFAULT '17:00',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default rows for status and config
INSERT INTO mt5_bot_status (id) VALUES ('1') ON CONFLICT (id) DO NOTHING;
INSERT INTO mt5_config (id) VALUES ('1') ON CONFLICT (id) DO NOTHING;

-- Enable RLS but allow service role full access
ALTER TABLE mt5_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE mt5_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mt5_bot_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE mt5_config ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access" ON mt5_signals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON mt5_positions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON mt5_bot_status FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON mt5_config FOR ALL USING (true) WITH CHECK (true);
```

---

## Executando o Bot

### Modo Interativo (Teste)

```
cd C:\ForexAI\mt5-bot
venv\Scripts\activate
python bot.py
```

Voce vera logs no console como:
```
2026-03-05 10:30:00 | INFO    | ForexAI MT5 Bot v1.0.0 starting …
2026-03-05 10:30:00 | INFO    | MT5 connected: login=12345678  server=MetaQuotes-Demo  balance=10000.00
2026-03-05 10:30:01 | INFO    | Bot running — poll every 30s, position sync every 60s, heartbeat every 60s
```

### Modo Background (Producao)

Para rodar o bot em background e manter rodando mesmo quando voce fecha o terminal:

#### Opcao 1: Usando `pythonw` (sem janela)

```
pythonw bot.py
```

#### Opcao 2: Usando Task Scheduler do Windows

1. Abra **Task Scheduler** (Agendador de Tarefas)
2. Clique em **Create Basic Task**
3. Nome: `ForexAI MT5 Bot`
4. Trigger: **When the computer starts**
5. Action: **Start a program**
6. Program: `C:\ForexAI\mt5-bot\venv\Scripts\python.exe`
7. Arguments: `bot.py`
8. Start in: `C:\ForexAI\mt5-bot`
9. Marque **Run whether user is logged on or not**

#### Opcao 3: Usando NSSM (servico do Windows)

```
nssm install ForexAIBot C:\ForexAI\mt5-bot\venv\Scripts\python.exe bot.py
nssm set ForexAIBot AppDirectory C:\ForexAI\mt5-bot
nssm set ForexAIBot DisplayName "ForexAI MT5 Bot"
nssm set ForexAIBot Start SERVICE_AUTO_START
nssm start ForexAIBot
```

---

## Ativar o Auto-Trading

O bot inicia com auto-trading **DESATIVADO** por seguranca. Para ativar:

1. Acesse o **Supabase Dashboard**
2. Vá em **Table Editor**
3. Abra a tabela `mt5_config`
4. Na linha com `id = '1'`, mude `auto_trading_enabled` para `true`
5. O bot detectara a mudanca no proximo ciclo de polling (max 30s)

Ou via SQL:
```sql
UPDATE mt5_config SET auto_trading_enabled = true WHERE id = '1';
```

### Configuracoes Disponiveis

| Campo | Padrao | Descricao |
|-------|--------|-----------|
| `auto_trading_enabled` | false | Ligar/desligar o auto-trading |
| `max_lot_size` | 0.1 | Tamanho maximo do lote por ordem |
| `risk_per_trade_pct` | 2.0 | Risco maximo por trade (% do saldo) |
| `allowed_symbols` | `[]` | Lista de pares permitidos (vazio = todos) |
| `max_open_positions` | 5 | Maximo de posicoes abertas simultaneas |
| `min_confidence` | 70 | Confianca minima do sinal (%) |
| `strategy_filter` | `[]` | Estrategias permitidas (vazio = todas) |
| `stop_loss_default_pips` | 50 | SL padrao em pips (se nao especificado) |
| `take_profit_default_pips` | 100 | TP padrao em pips (se nao especificado) |
| `trading_hours_start` | 09:00 | Horario de inicio (UTC) |
| `trading_hours_end` | 17:00 | Horario de fim (UTC) |

### Exemplo: Permitir apenas EUR/USD e GBP/USD

```sql
UPDATE mt5_config
SET allowed_symbols = '["EUR/USD", "GBP/USD"]'
WHERE id = '1';
```

---

## Arquitetura e Fluxo

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   ForexAI API    │     │    Supabase      │     │   MT5 Bot        │
│   (Vercel)       │────▶│   (Database)     │◀────│   (VPS Windows)  │
│                  │     │                  │     │                  │
│ Gera sinais de   │     │ mt5_signals      │     │ Polling a cada   │
│ trading via IA   │     │ mt5_positions    │     │ 30 segundos      │
│                  │     │ mt5_config       │     │                  │
│ Frontend mostra  │     │ mt5_bot_status   │     │ Executa ordens   │
│ posicoes/status  │     │                  │     │ via MT5 Python   │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

**Fluxo:**
1. A IA do ForexAI analisa o mercado e gera um sinal (insere na tabela `mt5_signals` com status `pending`)
2. O bot faz polling da tabela a cada 30 segundos
3. Quando encontra um sinal `pending`, verifica as regras de seguranca:
   - Auto-trading esta ativado?
   - O sinal tem confianca suficiente?
   - O par esta na lista de permitidos?
   - Nao excedeu o limite de posicoes abertas?
   - Esta dentro do horario de trading?
4. Se tudo OK, executa a ordem no MT5
5. Atualiza o status do sinal para `executed` ou `failed`
6. Sincroniza as posicoes abertas com a tabela `mt5_positions`
7. Envia heartbeat com informacoes da conta para `mt5_bot_status`

---

## Estrutura de Arquivos

```
mt5-bot/
├── bot.py               # Loop principal do bot
├── config.py            # Carregamento de configuracoes
├── mt5_executor.py      # Execucao de ordens no MT5
├── supabase_client.py   # Comunicacao com o Supabase
├── requirements.txt     # Dependencias Python
├── .env.example         # Template de configuracao
├── .env                 # Suas configuracoes (NAO comitar)
├── bot.log              # Log do bot (gerado automaticamente)
└── INSTALL.md           # Este guia
```

---

## Troubleshooting

### 1. Erro: "MT5 initialize() failed"

**Causa**: MT5 nao esta rodando ou caminho esta incorreto.

**Solucao**:
- Verifique se o MT5 esta aberto e conectado
- Confirme o caminho no `.env`: `MT5_PATH=C:\Program Files\MetaTrader 5\terminal64.exe`
- Tente abrir o MT5 manualmente antes de rodar o bot
- Verifique se o Python e o MT5 sao ambos 64-bit

### 2. Erro: "MT5 login() failed"

**Causa**: Credenciais incorretas.

**Solucao**:
- Verifique `MT5_LOGIN` (numero da conta)
- Verifique `MT5_PASSWORD`
- Verifique `MT5_SERVER` (nome exato do servidor do broker)
- Teste o login manualmente no MT5

### 3. Erro: "Supabase HTTP 401"

**Causa**: Chave de API invalida.

**Solucao**:
- Verifique `SUPABASE_SERVICE_KEY` (deve ser a **service_role** key, nao a anon key)
- Verifique `SUPABASE_URL`

### 4. Erro: "Symbol EURUSD not found"

**Causa**: O par nao esta na lista do Market Watch do MT5.

**Solucao**:
- Abra o MT5
- Va em View → Market Watch
- Clique com botao direito → Show All
- O bot tenta adicionar automaticamente, mas alguns brokers usam sufixos (ex: EURUSDm)

### 5. Erro: "order_send failed: retcode=10030"

**Causa**: Fill policy nao suportada pelo broker.

**Solucao**: O bot tenta detectar automaticamente o fill policy. Se o erro persistir, verifique no MT5:
- Abra uma ordem manualmente
- Veja qual tipo de execucao o broker aceita

### 6. Erro: "order_send failed: retcode=10018"

**Causa**: Mercado fechado ou horario de trading.

**Solucao**:
- Verifique se o mercado esta aberto (forex funciona 24h segunda-sexta, fecha no fim de semana)
- Verifique `trading_hours_start` e `trading_hours_end` na configuracao

### 7. Sinais ficam em "pending" e nao sao executados

**Causa**: Auto-trading desativado ou regras de seguranca bloqueando.

**Solucao**:
- Verifique se `auto_trading_enabled = true` no `mt5_config`
- Verifique os logs do bot para ver o motivo do skip
- Verifique se `min_confidence` nao esta muito alto
- Verifique se `allowed_symbols` inclui o par do sinal

### 8. Bot para quando fecho o terminal

**Causa**: Rodando em modo interativo.

**Solucao**: Configure o bot como servico do Windows (veja secao "Modo Background") ou use `pythonw bot.py`.

---

## Logs

O bot gera logs em dois lugares:
- **Console**: Nivel configurado em `LOG_LEVEL` (padrao: INFO)
- **Arquivo**: `bot.log` no mesmo diretorio (sempre nivel DEBUG)

Para ver os logs em tempo real:
```
# No PowerShell
Get-Content bot.log -Wait -Tail 50

# No CMD
powershell Get-Content bot.log -Wait -Tail 50
```

Para aumentar o detalhamento dos logs, mude no `.env`:
```
LOG_LEVEL=DEBUG
```

---

## Seguranca

- **Nunca** compartilhe sua `SUPABASE_SERVICE_KEY`
- **Nunca** compartilhe sua `MT5_PASSWORD`
- O arquivo `.env` esta no `.gitignore` — nao comite suas credenciais
- O bot usa a **service_role key** para acesso total ao Supabase
- Auto-trading comeca **desativado** — voce precisa ativar manualmente
- Sempre teste com **conta demo** antes de usar conta real
- Configure `max_lot_size` e `max_open_positions` de acordo com seu gerenciamento de risco

---

## Suporte

Se precisar de ajuda, verifique:
1. Os logs do bot (`bot.log`)
2. O status do bot na tabela `mt5_bot_status` (heartbeat recente?)
3. As posicoes na tabela `mt5_positions`
4. Os sinais na tabela `mt5_signals`

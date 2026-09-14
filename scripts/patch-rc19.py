from pathlib import Path
root=Path(__file__).resolve().parent.parent
p=root/'src/ts/economy.ts';s=p.read_text()
s=s.replace('    passengerSatisfactionSamples = 0;', '''    // RC19: cumulative counters are not a substitute for a complete journal.
    // Legacy versions already discarded entries; never claim to reconstruct them.
    historyInheritedTruncation = false;
    private _transactionTime(): number {
        const ms = typeof window !== 'undefined' ? window.game?.engine?.getSimulationEpochMs?.() : null;
        return typeof ms === 'number' && Number.isFinite(ms) ? ms : Date.now();
    }
    passengerSatisfactionSamples = 0;''')
s=s.replace('        if (this.history.length > 500)\n            this.history.shift();','')
s=s.replace('                if(this.history.length>500)this.history.shift();','')
s=s.replace('            if (this.dailySnapshots.length > 30)\n                this.dailySnapshots.shift();','')
s=s.replace('history: this.history.slice(-500),','history: this.history.map(entry => ({...entry})),\n            historyVersion: 1,\n            historyInheritedTruncation: this.historyInheritedTruncation,')
s=s.replace('dailySnapshots: this.dailySnapshots.slice(-30),','dailySnapshots: this.dailySnapshots.map(day => ({...day})),')
s=s.replace('))).slice(-500).map(', '))).map(').replace(')).slice(-30).map(',')).map(')
s=s.replace('        this.dailyProcessed = (data.dailyProcessed', '        this.historyInheritedTruncation = data.historyVersion !== 1 || data.historyInheritedTruncation === true;\n        this.dailyProcessed = (data.dailyProcessed')
s=s.replace('time: Date.now()','time: this._transactionTime()').replace('time:Date.now()','time:this._transactionTime()')
s=s.replace('// Daily snapshots for financial charts (last 30 days)', '// Daily snapshots retained for the complete financial recap')
p.write_text(s)
p=root/'src/ts/bank.ts';s=p.read_text().replace('        if (economy.history.length > 200)\n            economy.history.shift();','');p.write_text(s)

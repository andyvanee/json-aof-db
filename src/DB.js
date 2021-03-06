import fs from "fs"
import path from "path"

export class DB {
    static get actions() {
        return ["create", "update", "delete"]
    }

    constructor(filepath) {
        this.path = path.resolve(filepath)
        this.records = []
        this.nextId = 0
    }

    load() {
        this.records = []
        this.nextId = 0
        const actions = DB.actions
        try {
            if (!fs.existsSync(this.path)) this.flush()

            const data = fs
                .readFileSync(this.path, { encoding: "utf8" })
                .split(/\r?\n/)
            for (const line of data) {
                if (!line) continue
                const [_, cmd, id, json] = /^(\w+)\s+(\d+)\s*(.*)$/g.exec(line)
                if (!(cmd && id)) continue
                if (!actions.includes(cmd)) continue
                const record = JSON.parse(json || "{}")
                const rowid = parseInt(id)
                this[cmd](rowid, record, false)
            }
        } catch (err) {
            console.log({ err })
        }
        return this
    }

    get all() {
        return this.records
            .map((r, rowid) =>
                r ? Object.assign({}, r, { rowid }) : { deleted: true }
            )
            .filter(r => !r.deleted)
    }

    writeCmd(cmd, rowid, record) {
        const cstring = `${cmd} ${rowid} ${JSON.stringify(record)}\n`
        const flag = "a+"
        fs.writeFileSync(this.path, cstring, { flag })
    }

    create(rowid, record, write = true) {
        if (rowid !== this.nextId) {
            throw `Invalid index for create given:${rowid}, expected:${this.nextId}`
        }
        const data = Object.assign({}, record, { rowid })
        this.nextId = this.nextId > rowid ? this.nextId : rowid
        this.records[rowid] = data
        this.nextId += 1
        if (write) this.writeCmd("create", rowid, data)
        return data
    }

    update(rowid, record, write = true) {
        const o = this.records[rowid] || {}
        const updated = Object.assign({}, o, record, { rowid })

        const diff = {} // Store only changes
        for (const [k, v] of Object.entries(updated)) {
            if (JSON.stringify(o[k]) !== JSON.stringify(v)) diff[k] = v
        }

        this.records[rowid] = updated
        if (write && JSON.stringify(diff) !== "{}") {
            this.writeCmd("update", rowid, diff)
        }
        return updated
    }

    delete(rowid, _, write = true) {
        this.records[rowid] = null
        if (write) this.writeCmd("delete", rowid, "")
        return true
    }

    flush() {
        this.records = []
        this.nextId = 0
        const flag = "w"
        fs.writeFileSync(this.path, "", { flag })
    }
}

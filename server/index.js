import express from 'express'
import logger from 'morgan'
import { Server  } from 'socket.io'
import { createServer } from 'node:http'
import dotenv from 'dotenv'
import { createClient } from '@libsql/client'

//Load environment variables
dotenv.config()

//Get port from environment variables or use 3000
const port = process.env.PORT ?? 3000

//Create express app
const app = express()

//Create server wth node http
const server = createServer(app)
//Create socket io server
const io = new Server(server, {
    connectionStateRecovery: {}
})

const db = createClient({
    url: 'libsql://welcomed-punch-man-wilsongutierrez-01.turso.io',
    authToken: process.env.DB_AUTH_TOKEN
})

await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL
    )    
`)
app.use(logger('dev'))

//Socket io connection
io.on('connection', async (socket) => {
    console.log('New user connected')

   socket.on('disconnect', () => {
       console.log('User disconnected')
   })

   socket.on('chat message', async (msg) => {
        let result
        try {
            result = await db.execute({
                sql: `INSERT INTO messages (content) VALUES (:msg)`,
                args: { msg }
            })
        } catch (error) {
            console.error(error)
            return
        }
        io.emit('chat message', msg, result.lastInsertRowid.toString())
   })

   if (!socket.recovered){
    try {
        const result = await db.execute({
           sql: `SELECT id, content FROM messages WHERE id > ?`,
           args: [socket.handshake.auth.serverOffset ?? 0]
        })

        result.rows.forEach(row => {
            socket.emit('chat message', row.content, row.id.toString())
        })
    }catch (error) {
        console.error(error)
    }
   }
})
app.get('/', (req, res) => {
    res.sendFile(process.cwd() + '/client/index.html')
})

server.listen(port, () => {
    console.log(`Server is running on port ${port}`)
})
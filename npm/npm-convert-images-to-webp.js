import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const IMAGES_DIR = path.join(ROOT, 'public/images')
const DATA_DIR = path.join(ROOT, 'public/data')

const QUALITY = 85
const SKIP_DIRS = [] // tambah nama folder jika ingin di-skip

async function convertToWebP(filePath) {
    const ext = path.extname(filePath).toLowerCase()
    if (!['.png', '.jpg', '.jpeg'].includes(ext)) return null

    const webpPath = filePath.replace(/\.(png|jpg|jpeg)$/i, '.webp')
    const originalSize = fs.statSync(filePath).size

    await sharp(filePath)
        .webp({ quality: QUALITY })
        .toFile(webpPath)

    const newSize = fs.statSync(webpPath).size
    const saved = ((originalSize - newSize) / originalSize * 100).toFixed(1)

    fs.unlinkSync(filePath)

    const rel = path.relative(ROOT, filePath)
    const relNew = path.relative(ROOT, webpPath)
    console.log(`  ✓ ${rel} → ${relNew}  (${(originalSize/1024).toFixed(0)}KB → ${(newSize/1024).toFixed(0)}KB, -${saved}%)`)
    return { from: rel, to: relNew }
}

function walkDir(dir) {
    const results = []
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            if (!SKIP_DIRS.includes(entry.name)) results.push(...walkDir(fullPath))
        } else {
            results.push(fullPath)
        }
    }
    return results
}

function updateJsonReferences(conversions) {
    const jsonFiles = walkDir(DATA_DIR).filter(f => f.endsWith('.json'))
    let totalUpdated = 0

    for (const jsonFile of jsonFiles) {
        let content = fs.readFileSync(jsonFile, 'utf8')
        let changed = false

        for (const { from, to } of conversions) {
            // Normalize to forward slashes and strip leading "public/"
            const fromRel = from.replace(/\\/g, '/').replace(/^public\//, '')
            const toRel = to.replace(/\\/g, '/').replace(/^public\//, '')

            if (content.includes(fromRel)) {
                content = content.split(fromRel).join(toRel)
                changed = true
            }
        }

        if (changed) {
            fs.writeFileSync(jsonFile, content, 'utf8')
            console.log(`  📝 Updated references: ${path.relative(ROOT, jsonFile)}`)
            totalUpdated++
        }
    }

    return totalUpdated
}

async function main() {
    console.log('\n🖼️  Converting images to WebP...\n')

    const files = walkDir(IMAGES_DIR)
    const imageFiles = files.filter(f => /\.(png|jpg|jpeg)$/i.test(f))

    if (imageFiles.length === 0) {
        console.log('No PNG/JPG images found.')
        return
    }

    const conversions = []
    for (const file of imageFiles) {
        const result = await convertToWebP(file)
        if (result) conversions.push(result)
    }

    console.log(`\n📄 Updating JSON references...\n`)
    const updated = updateJsonReferences(conversions)

    console.log(`\n✅ Done! Converted ${conversions.length} images, updated ${updated} JSON files.\n`)
}

main().catch(err => {
    console.error('Error:', err)
    process.exit(1)
})

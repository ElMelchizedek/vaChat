export async function file(path: string) {
    return await Bun.file(path).text()
}
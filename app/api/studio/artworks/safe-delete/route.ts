import {NextResponse} from "next/server";
export async function POST(){return NextResponse.json({error:"Artwork deletion from Manage Prints is retired. Use Remove from prints instead."},{status:410,headers:{"Cache-Control":"no-store"}});}

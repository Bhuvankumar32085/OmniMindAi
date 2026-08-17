def extract_text(content):
    if isinstance(content, str):
        return content

    if isinstance(content, dict):
        ctype = content.get("type")
        if ctype == "clarification":
            question = content.get("question")
            if isinstance(question, dict):
                return question.get("text") or content.get("text") or ""
            return content.get("text") or ""
        elif ctype == "text":
            return content.get("text") or ""
        elif ctype == "pdf":
            return f"[Generated PDF Document: {content.get('title', 'Document.pdf')}]"
        elif ctype == "ppt":
            return f"[Generated Presentation: {content.get('title', 'Presentation.pptx')}]"
        elif ctype == "image":
            return "[Generated Image]"
        elif ctype == "error":
            return f"[Error: {content.get('message', '')}]"
        
        return content.get("text") or content.get("content") or ""

    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                parts.append(extract_text(item))
        return "".join(parts)

    return ""


def text_content(content):
    return {
        "type": "text",
        "text": extract_text(content),
    }

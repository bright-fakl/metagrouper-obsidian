# Tag Tree View - Examples and Use Cases

This guide provides real-world examples and configurations for the Tag Tree View plugin. Use these as inspiration for organizing your own vault!

## Table of Contents

1. [Simple Tag Hierarchies](#simple-tag-hierarchies)
2. [Project Management](#project-management)
3. [Research and Academia](#research-and-academia)
4. [Content Creation](#content-creation)
5. [Personal Knowledge Management](#personal-knowledge-management)
6. [Software Development](#software-development)
7. [Meeting Notes](#meeting-notes)
8. [Learning and Study](#learning-and-study)
9. [Creative Writing](#creative-writing)
10. [Codeblock Examples](#codeblock-examples)

---

## Simple Tag Hierarchies

### Example 1: Basic Nested Tags

**Use Case**: Organizing notes by broad categories

**Tags Structure**:
```
#work
#work/projects
#work/projects/alpha
#work/projects/beta
#work/meetings
#personal
#personal/health
#personal/finance
```

**View Configuration**:
```yaml
name: "All Categories"
levels:
  - type: tag
    key: ""
```

**Result**:
```
📁 work (15)
  📁 projects (10)
    📁 alpha (5)
    📁 beta (5)
  📁 meetings (5)
📁 personal (8)
  📁 health (4)
  📁 finance (4)
```

---

## Project Management

### Example 2: Projects by Status

**Use Case**: Tracking multiple projects with different statuses

**Frontmatter Example**:
```yaml
---
project: Website Redesign
status: active
priority: high
assignee: Alice
tags: [project]
---
```

**View Configuration**:
```yaml
name: "Projects Dashboard"
rootTag: "#project"
levels:
  - type: property
    key: "project"
  - type: property
    key: "status"
  - type: property
    key: "priority"
```

**Result**:
```
📋 Website Redesign (8)
  📋 active (5)
    📋 high (3)
      📄 Homepage Mockup.md
      📄 Color Scheme.md
      📄 Navigation Design.md
    📋 medium (2)
      📄 Footer Layout.md
      📄 About Page.md
  📋 planning (2)
    📋 low (2)
      📄 Future Features.md
      📄 SEO Strategy.md
  📋 completed (1)
    📋 high (1)
      📄 Logo Design.md
```

### Example 3: Agile Sprint Board

**Use Case**: Managing tasks in agile sprints

**Frontmatter Example**:
```yaml
---
project: Mobile App
sprint: Sprint 23
status: in-progress
story-points: 5
tags: [sprint/s23]
---
```

**View Configuration**:
```yaml
name: "Sprint Board"
rootTag: "#sprint"
levels:
  - type: tag
    key: "sprint"
    label: "Sprint"
  - type: property
    key: "status"
    label: "Status"
  - type: property
    key: "assignee"
    label: "Assigned To"
```

### Example 4: Project Timeline

**Use Case**: Organizing project tasks by deadline

**Frontmatter Example**:
```yaml
---
project: Product Launch
quarter: Q2-2024
month: April
status: active
tags: [project/launch]
---
```

**View Configuration**:
```yaml
name: "Project Timeline"
rootTag: "#project"
levels:
  - type: property
    key: "quarter"
  - type: property
    key: "month"
  - type: property
    key: "project"
```

---

## Research and Academia

### Example 5: Research Papers by Field

**Use Case**: Organizing academic papers and literature

**Frontmatter Example**:
```yaml
---
type: paper
field: Machine Learning
subfield: Computer Vision
year: 2023
read-status: read
tags: [research/paper]
---
```

**View Configuration**:
```yaml
name: "Research Library"
rootTag: "#research/paper"
levels:
  - type: property
    key: "field"
  - type: property
    key: "subfield"
  - type: property
    key: "year"
```

**Result**:
```
📋 Machine Learning (24)
  📋 Computer Vision (15)
    📋 2023 (8)
      📄 Attention Mechanisms.md
      📄 Object Detection.md
      ...
    📋 2022 (7)
      📄 CNN Architectures.md
      ...
  📋 Natural Language Processing (9)
    📋 2023 (5)
    📋 2022 (4)
```

### Example 6: Research by Status

**Use Case**: Tracking reading progress

**View Configuration**:
```yaml
name: "Reading Pipeline"
rootTag: "#research"
levels:
  - type: property
    key: "read-status"
    label: "Status"
  - type: property
    key: "priority"
  - type: property
    key: "field"
```

**Result**:
```
📋 to-read (12)
  📋 high (5)
  📋 medium (7)
📋 reading (3)
  📋 high (2)
  📋 low (1)
📋 read (45)
  📋 high (20)
  📋 medium (25)
```

### Example 7: Academic Courses

**Use Case**: Organizing course notes and assignments

**Frontmatter Example**:
```yaml
---
course: CS101
semester: Fall 2024
type: lecture
week: 3
tags: [course/cs101]
---
```

**View Configuration**:
```yaml
name: "Course Materials"
rootTag: "#course"
levels:
  - type: tag
    key: "course"
    label: "Course"
  - type: property
    key: "type"
    label: "Type"
  - type: property
    key: "week"
    label: "Week"
```

---

## Content Creation

### Example 8: Blog Posts by Category

**Use Case**: Managing blog content pipeline

**Frontmatter Example**:
```yaml
---
category: Technology
subcategory: Web Development
status: draft
publication-date: 2024-03-15
tags: [blog/tech]
---
```

**View Configuration**:
```yaml
name: "Blog Pipeline"
rootTag: "#blog"
levels:
  - type: property
    key: "category"
  - type: property
    key: "status"
  - type: property
    key: "publication-date"
```

**Result**:
```
📋 Technology (15)
  📋 draft (5)
    📋 2024-03-20 (2)
    📋 2024-03-15 (3)
  📋 review (4)
    📋 2024-03-10 (4)
  📋 published (6)
    📋 2024-03-01 (3)
    📋 2024-02-15 (3)
📋 Lifestyle (8)
  ...
```

### Example 9: YouTube Video Planning

**Use Case**: Content creator pipeline

**Frontmatter Example**:
```yaml
---
series: Tech Tutorials
episode: 15
status: scripting
estimated-length: 10-15 min
tags: [video/tutorial]
---
```

**View Configuration**:
```yaml
name: "Video Production"
rootTag: "#video"
levels:
  - type: property
    key: "status"
    label: "Production Stage"
  - type: property
    key: "series"
  - type: property
    key: "episode"
```

---

## Personal Knowledge Management

### Example 10: Zettelkasten Organization

**Use Case**: Organizing atomic notes by topic

**Frontmatter Example**:
```yaml
---
type: permanent-note
topic: Philosophy
subtopic: Ethics
connections: 5
tags: [zettel/philosophy]
---
```

**View Configuration**:
```yaml
name: "Zettelkasten"
rootTag: "#zettel"
levels:
  - type: property
    key: "topic"
  - type: property
    key: "subtopic"
  - type: property
    key: "type"
```

### Example 11: Book Notes

**Use Case**: Organizing reading notes and highlights

**Frontmatter Example**:
```yaml
---
book: Thinking, Fast and Slow
author: Daniel Kahneman
genre: Psychology
read-status: reading
rating: 5
tags: [book/psychology]
---
```

**View Configuration**:
```yaml
name: "Reading Notes"
rootTag: "#book"
levels:
  - type: property
    key: "genre"
  - type: property
    key: "read-status"
  - type: property
    key: "rating"
```

### Example 12: Areas of Life

**Use Case**: PARA method organization

**Tags Structure**:
```
#area/health
#area/health/fitness
#area/health/nutrition
#area/career
#area/career/skills
#area/career/networking
#area/relationships
#area/finance
```

**View Configuration**:
```yaml
name: "Life Areas"
rootTag: "#area"
levels:
  - type: tag
    key: "area"
```

---

## Software Development

### Example 13: Code Documentation

**Use Case**: Organizing development notes and documentation

**Frontmatter Example**:
```yaml
---
project: MyApp
component: Authentication
language: TypeScript
type: documentation
tags: [dev/myapp]
---
```

**View Configuration**:
```yaml
name: "Dev Docs"
rootTag: "#dev"
levels:
  - type: property
    key: "project"
  - type: property
    key: "component"
  - type: property
    key: "type"
```

### Example 14: Bug Tracking

**Use Case**: Development issue tracking

**Frontmatter Example**:
```yaml
---
project: API Server
severity: high
status: open
assigned-to: Bob
issue-type: bug
tags: [dev/bug]
---
```

**View Configuration**:
```yaml
name: "Bug Tracker"
rootTag: "#dev/bug"
levels:
  - type: property
    key: "status"
  - type: property
    key: "severity"
  - type: property
    key: "project"
```

### Example 15: Learning Resources

**Use Case**: Organizing tutorials and learning materials

**Frontmatter Example**:
```yaml
---
topic: React
resource-type: tutorial
difficulty: intermediate
completed: false
tags: [learn/react]
---
```

**View Configuration**:
```yaml
name: "Learning Path"
rootTag: "#learn"
levels:
  - type: tag
    key: "learn"
    label: "Topic"
  - type: property
    key: "difficulty"
  - type: property
    key: "completed"
```

---

## Meeting Notes

### Example 16: Meeting Organization

**Use Case**: Corporate meeting notes

**Frontmatter Example**:
```yaml
---
meeting-type: standup
project: Q1 Planning
date: 2024-03-15
attendees: [Alice, Bob, Charlie]
tags: [meeting/standup]
---
```

**View Configuration**:
```yaml
name: "Meetings"
rootTag: "#meeting"
levels:
  - type: tag
    key: "meeting"
    label: "Type"
  - type: property
    key: "project"
  - type: property
    key: "date"
```

---

## Learning and Study

### Example 17: Language Learning

**Use Case**: Organizing language study materials

**Frontmatter Example**:
```yaml
---
language: Spanish
level: intermediate
topic: Grammar
lesson: 15
mastery: practicing
tags: [language/spanish]
---
```

**View Configuration**:
```yaml
name: "Language Learning"
rootTag: "#language"
levels:
  - type: tag
    key: "language"
  - type: property
    key: "level"
  - type: property
    key: "mastery"
```

### Example 18: Exam Preparation

**Use Case**: Study material organization

**Frontmatter Example**:
```yaml
---
exam: Final Exam
subject: Biology
chapter: 7
difficulty: hard
reviewed: true
tags: [exam/bio]
---
```

**View Configuration**:
```yaml
name: "Exam Prep"
rootTag: "#exam"
levels:
  - type: tag
    key: "exam"
    label: "Exam"
  - type: property
    key: "reviewed"
  - type: property
    key: "difficulty"
```

---

## Creative Writing

### Example 19: Novel Organization

**Use Case**: Organizing chapters and character notes

**Frontmatter Example**:
```yaml
---
novel: The Great Adventure
type: chapter
act: 1
chapter: 3
status: draft
tags: [writing/novel]
---
```

**View Configuration**:
```yaml
name: "Novel Structure"
rootTag: "#writing/novel"
levels:
  - type: property
    key: "novel"
  - type: property
    key: "act"
  - type: property
    key: "type"
```

**Result**:
```
📋 The Great Adventure (45)
  📋 Act 1 (15)
    📋 chapter (12)
      📄 Chapter 1.md
      📄 Chapter 2.md
      ...
    📋 character (3)
      📄 Protagonist.md
      📄 Antagonist.md
      📄 Supporting Cast.md
  📋 Act 2 (20)
    ...
  📋 Act 3 (10)
    ...
```

### Example 20: Story Ideas

**Use Case**: Managing writing prompts and ideas

**Frontmatter Example**:
```yaml
---
genre: Sci-Fi
theme: Time Travel
status: concept
priority: high
tags: [idea/story]
---
```

**View Configuration**:
```yaml
name: "Story Ideas"
rootTag: "#idea/story"
levels:
  - type: property
    key: "status"
  - type: property
    key: "genre"
  - type: property
    key: "priority"
```

---

## Codeblock Examples

### Example 21: Embedding in a MOC (Map of Content)

**Use Case**: Create an overview page with embedded tree

```markdown
# Projects Overview

This page provides an overview of all active projects.

```tagtree
view: "Projects Dashboard"
expanded: 2
```

## Completed Projects

```tagtree
root: #project
levels:
  - property: "status"
  - property: "completion-date"
sort: count-desc
expanded: 1
```
```

### Example 22: Dashboard with Multiple Trees

**Use Case**: Personal dashboard with different views

```markdown
# My Dashboard

## Current Focus
```tagtree
root: #today
levels:
  - property: "priority"
sort: alpha-asc
expanded: all
```

## Active Projects
```tagtree
view: "Projects Dashboard"
expanded: 1
```

## Upcoming Meetings
```tagtree
root: #meeting
levels:
  - property: "date"
sort: alpha-asc
expanded: 2
```
```

### Example 23: Reading List Embed

**Use Case**: Embedded reading tracker

```markdown
# Reading List

## Currently Reading
```tagtree
root: #book
levels:
  - property: "read-status"
  - property: "genre"
sort: alpha-asc
expanded: 2
interactive: true
```

## Book Stats

Total books tracked: 156
Currently reading: 3
Completed this year: 24
```

### Example 24: Simple List Format

**Use Case**: Compact display in notes

```markdown
# Quick Reference

## Project Tags
```tagtree
root: #project
levels:
  - tag: "project"
format: list
expanded: all
interactive: false
```
```

**Result**:
```
• project (15)
  • alpha (7)
    • Feature A.md
    • Feature B.md
  • beta (8)
    • Planning.md
    • Design.md
```

### Example 25: Mixed Configuration

**Use Case**: Complex inline tree with all options

```markdown
# Research Status

```tagtree
root: #research/paper
levels:
  - property: "field"
    label: "Research Field"
  - property: "year"
    label: "Publication Year"
  - property: "read-status"
    label: "Reading Status"
sort: count-desc
expanded: 2
format: tree
interactive: true
```
```

---

## Combining Multiple Approaches

### Example 26: Hybrid Project + Time View

**Use Case**: Track projects by time and status

**Two Views:**

**View 1: By Project Status**
```yaml
name: "Projects by Status"
rootTag: "#project"
levels:
  - type: property
    key: "status"
  - type: property
    key: "project"
  - type: property
    key: "priority"
```

**View 2: By Timeline**
```yaml
name: "Projects by Timeline"
rootTag: "#project"
levels:
  - type: property
    key: "quarter"
  - type: property
    key: "project"
  - type: property
    key: "status"
```

Switch between these views to get different perspectives on the same data!

---

## Best Practices from Examples

### 1. Consistent Property Names
All examples use consistent property names across notes:
- `status` not `state` or `current-status`
- `priority` not `importance` or `urgency`

### 2. Hierarchical Tags
Use slashes for natural hierarchies:
- `#project/alpha/feature` not `#project-alpha-feature`

### 3. Multi-Level Properties
Combine broad and specific properties:
- Level 1: Broad (e.g., "project")
- Level 2: Status (e.g., "status")
- Level 3: Details (e.g., "priority")

### 4. Root Tag Filtering
Create focused views with root tags:
- `#project` for project view
- `#research` for research view
- `#meeting` for meeting view

### 5. Multiple Views
Create views for different contexts:
- **Status View**: Group by status/priority
- **Timeline View**: Group by date/quarter
- **Person View**: Group by assignee/author
- **Type View**: Group by note type

---

## Customization Tips

### Modify These Examples

1. **Change Property Names**: Adapt to your vault's schema
2. **Adjust Hierarchy Levels**: Add or remove levels as needed
3. **Experiment with Sorting**: Try different sort modes
4. **Set Default Expansion**: Find what works for your vault size
5. **Combine Ideas**: Mix elements from multiple examples

### Create Your Own

Start with a simple example and iterate:
1. Begin with basic tag hierarchy
2. Add one property level
3. Test and refine
4. Add more complexity gradually
5. Create multiple views for different needs

---

## Next Steps

- **Try an Example**: Pick one that matches your workflow
- **Adapt It**: Modify to fit your vault structure
- **Share Your Setup**: Contribute your examples to help others
- **Explore More**: See [User Guide](user-guide.md) for detailed features

Happy organizing! 🎯✨
